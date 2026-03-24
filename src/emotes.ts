import { EmoteDbRow, CachedEmote } from './interfaces/general';

const emoteMemCache = new Map<string, CachedEmote>();

function ensureEmoteStore(db: IDBDatabase) {
    if (!db.objectStoreNames.contains('emotes')) {
        db.createObjectStore('emotes', { keyPath: 'id' });
    }
}

function getEmoteCacheDb() {
    return new Promise<IDBDatabase>((resolve, reject) => {
        const openReq = indexedDB.open('ytEmoteCache', 1);

        openReq.onupgradeneeded = (evt) => {
            const db = (evt.target as IDBOpenDBRequest).result;
            ensureEmoteStore(db);
        };

        openReq.onsuccess = (evt) => {
            const db = (evt.target as IDBOpenDBRequest).result;
            resolve(db);
        };

        openReq.onerror = () => {
            reject(new Error(`IndexedDB open failed: ${openReq.error?.message}`));
        };
    });
}

async function downloadEmoteToCache(emoteId: string, shortcutName: string, originalUrl: string) {
    const db = await getEmoteCacheDb();

    console.log(`Downloading emote ${shortcutName} (${emoteId}) from ${originalUrl}...`);
    const imgRes = await fetch(originalUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch emote image: ${imgRes.statusText}`);

    const imgBlob = await imgRes.blob();
    const imgRow: EmoteDbRow = {
        id: emoteId,
        shortcutName,
        originalUrl,
        blob: imgBlob,
    };

    ensureEmoteStore(db);
    const tx = db.transaction('emotes', 'readwrite');
    const store = tx.objectStore('emotes');
    store.put(imgRow);

    return imgRow;
}

async function retrieveEmoteFromCache(emoteId: string) {
    const db = await getEmoteCacheDb();
    ensureEmoteStore(db);

    const tx = db.transaction('emotes', 'readonly');
    const store = tx.objectStore('emotes');

    return new Promise<EmoteDbRow | null>((resolve, reject) => {
        const req = store.get(emoteId);

        req.onsuccess = () => {
            resolve(req.result || null);
        };
        req.onerror = () => {
            reject(new Error(`IndexedDB retrieval failed: ${req.error?.message}`));
        };
    });
}

export async function cacheEmote(emoteId: string, shortcutName: string, originalUrl: string) {
    if (emoteMemCache.has(emoteId)) {
        return emoteMemCache.get(emoteId)!;
    }

    const cachedEmote: CachedEmote = {
        id: emoteId,
        shortcutName,
        originalUrl,
    };

    try {
        const emoteDbRow = (await retrieveEmoteFromCache(emoteId))
            || (await downloadEmoteToCache(emoteId, shortcutName, originalUrl));

        cachedEmote.localUrl = URL.createObjectURL(emoteDbRow.blob);
    } catch (error) {
        console.error(`Error caching emote ${shortcutName} (${emoteId}):`, error);
        cachedEmote.fetchError = `${error}`;
    }

    emoteMemCache.set(emoteId, cachedEmote);
    return cachedEmote;
}

export function getEmoteLocalUrl(emoteId: string) {
    if (emoteMemCache.has(emoteId)) {
        return emoteMemCache.get(emoteId)!.localUrl || null;
    }
    return null;
}
