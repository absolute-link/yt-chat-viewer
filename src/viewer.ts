import { setErrorMsg, clearErrorMsg } from './errors';
import { getChunksToLinesTransform } from './lines';
import { RawChatEvent } from './interfaces/yt';
import { AppState, AppRunningStats, AppUserStats, AppAggregateStats } from './interfaces/state';
import { processChatMessage } from './parser';

const APP: AppState = {
    loadedFile: '',
    htmlLines: [],
    currentPage: 1,
    limitPerPage: 1000,
    runningStats: freshRunningStats(),
    userStats: freshUserStats(),
    aggregateStats: freshAggregateStats(),
};

function freshRunningStats(): AppRunningStats {
    return {
        numChatMessages: 0,
        numMemberChats: 0,
        numModChats: 0,
        numOwnerChats: 0,
        numGreyChats: 0,
        numGiftPurchases: 0,
        totalGiftsPurchased: 0,
        totalGiftsRedeemed: 0,
        numMembershipJoins: 0,
        numMilestoneMessages: 0,
        numSuperchats: 0,
        numSuperStickers: 0,
    };
}

function freshUserStats(): AppUserStats {
    return {};
}

function freshAggregateStats(): AppAggregateStats {
    return {
        chatsPerUser: 0,
        pctMembers: 0,
        pctMemberChats: 0,
    };
}

function clearChat() {
    APP.loadedFile = '';
    APP.htmlLines = [];
    APP.runningStats = freshRunningStats();
    APP.userStats = freshUserStats();
    APP.aggregateStats = freshAggregateStats();

    const container = document.getElementById('chat');
    if (container) container.innerHTML = '';
}

function displayChat() {
    const container = document.getElementById('chat');
    if (!container) return;

    for (const line of APP.htmlLines) {
        const itemEl = document.createElement('div');
        itemEl.className = 'item';
        itemEl.innerHTML = line;

        container.appendChild(itemEl);
    }

    console.log(APP.runningStats);
    console.log(APP.aggregateStats);
    console.log(APP.userStats);
}

async function processJsonFile(fileObj: File) {
    const stream = fileObj.stream()
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(getChunksToLinesTransform());

    const reader = stream.getReader();

    while (true) {
        const { done, value } = await reader.read();
        if (done || !value) break;

        try {
            const msgData = JSON.parse(value);
            processChatMessage(APP, msgData as RawChatEvent);
        } catch(err) {
            console.error(err);
        }
    }
}

(async () => {
    const filePicker = document.getElementById('json-file');
    if (!filePicker || !(filePicker instanceof HTMLInputElement)) throw new Error('File element not found');

    filePicker.addEventListener('change', () => {
        clearChat();
        clearErrorMsg();
        if (!filePicker.files || !filePicker.files.length) return;

        const file = filePicker.files[0];
        if (file.type !== 'application/json') return setErrorMsg('Error: Please choose a JSON file');

        processJsonFile(file).then(displayChat);
    }, false);
})().catch((err) => {
    if (!err) return;
    if (err && typeof err.message === 'string') setErrorMsg(err.message);
    else setErrorMsg(err.toString());
});
