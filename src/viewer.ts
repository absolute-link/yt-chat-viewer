import { setErrorMsg, clearErrorMsg } from './errors';
import { getChunksToLinesTransform } from './lines';
import { RawChatEvent } from './interfaces/yt';
import { AppState, AppRunningStats, AppUserStats, AppAggregateStats } from './interfaces/state';
import { processChatMessage } from './parser';

const APP: AppState = {
    loadedFile: '',
    allChats: [],
    filteredChats: [],
    currentPage: 1,
    limitPerPage: 1500,
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
        colourTotals: {
            'red': 0,
            'pink': 0,
            'orange': 0,
            'yellow': 0,
            'light-green': 0,
            'light-blue': 0,
            'blue': 0,
        },
        currencyTotals: {},
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

function humanizeColour(colour: string) {
    return colour.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function roundCurrency(value: number) {
    return Math.round((value * 100) / 100);
}

function newStatsRow(label: string, value: number) {
    const rowEl = document.createElement('div');
    rowEl.className = 'stats-row';
    rowEl.innerHTML = `<span class="label">${label}</span><span class="value">${value}</span>`;
    return rowEl;
}

function updateStatsDialog() {
    const generalBody = document.getElementById('general-stats-body');
    if (!generalBody) throw new Error('General stats body not found');

    const monetizationBody = document.getElementById('monetization-stats-body');
    if (!monetizationBody) throw new Error('Monetization stats body not found');

    const currencyBody = document.getElementById('currency-stats-body');
    if (!currencyBody) throw new Error('Currency stats body not found');

    const stats = APP.runningStats;

    generalBody.innerHTML = '';
    monetizationBody.innerHTML = '';
    currencyBody.innerHTML = '';

    const generalStats: Map<string, number> = new Map([
        ['Total Messages', stats.numChatMessages],
        ['Member Chats', stats.numMemberChats],
        ['Non-Member Chats', stats.numGreyChats],
        ['Moderator Chats', stats.numModChats],
        ['Owner Chats', stats.numOwnerChats],
        ['Membership Joins', stats.numMembershipJoins],
        ['Milestone Messages', stats.numMilestoneMessages],
    ]);

    const monetizationStats: Map<string, number> = new Map([
        ['Number of Member Gifts', stats.numGiftPurchases],
        ['Total Memberships Gifted', stats.totalGiftsPurchased],
        ['Total Super Chats', stats.numSuperchats],
        ['Total Super Stickers', stats.numSuperStickers],
    ]);
    for (const [colour, count] of Object.entries(stats.colourTotals)) {
        monetizationStats.set(`${humanizeColour(colour)} SC / SS`, count);
    }

    const currencyStats: Map<string, number> = new Map();
    for (const [currencyLabel, total] of Object.entries(stats.currencyTotals)) {
        currencyStats.set(`Total ${currencyLabel}`, roundCurrency(total));
    }

    for (const [label, value] of generalStats.entries()) {
        generalBody.appendChild(newStatsRow(label, value));
    }
    for (const [label, value] of monetizationStats.entries()) {
        monetizationBody.appendChild(newStatsRow(label, value));
    }
    for (const [label, value] of currencyStats.entries()) {
        currencyBody.appendChild(newStatsRow(label, value));
    }
}

function clearChat() {
    APP.loadedFile = '';
    APP.allChats = [];
    APP.filteredChats = [];
    APP.currentPage = 1;
    APP.runningStats = freshRunningStats();
    APP.userStats = freshUserStats();
    APP.aggregateStats = freshAggregateStats();

    const container = document.getElementById('chat');
    if (container) container.innerHTML = '';
}

function filterChat(evt: Event) {
    evt.preventDefault();

    const typeDropdown = document.getElementById('filter-type');
    if (!typeDropdown || !(typeDropdown instanceof HTMLSelectElement)) throw new Error('Filter type dropdown not found');

    const textSearchBox = document.getElementById('search-text');
    if (!textSearchBox || !(textSearchBox instanceof HTMLInputElement)) throw new Error('Search text box not found');

    const searchText = textSearchBox.value.toLowerCase();
    APP.filteredChats = APP.allChats.filter((chat) => {
        if (typeDropdown.value === 'moderators') {
            if (!chat.isMod && !chat.isOwner) return false;
        }
        if (typeDropdown.value === 'monetized') {
            if (!chat.isSuperChat
                && !chat.isSuperSticker
                && !chat.isMembershipGift
                && !chat.isMembershipRedemption
                && !chat.isMembershipMessage
            ) return false;
        }
        if (searchText === '') return true;
        return (chat.textContent.toLowerCase().includes(searchText)
            || chat.userName.toLowerCase().includes(searchText)
        );
    });

    APP.currentPage = 1;
    displayChat();
}

function displayChat() {
    const container = document.getElementById('chat');
    if (!container) return;

    container.innerHTML = '';
    scrollTo(0, 0);

    const startIdx = (APP.currentPage - 1) * APP.limitPerPage;
    const endIdx = startIdx + APP.limitPerPage;

    for (let idx = startIdx; idx < endIdx && idx < APP.filteredChats.length; idx++) {
        const itemEl = document.createElement('div');
        itemEl.className = 'item';
        itemEl.innerHTML = APP.filteredChats[idx].htmlLine;

        container.appendChild(itemEl);
    }
    updatePageIndicator();
}

function getMaxPages(): number {
    return Math.ceil(APP.filteredChats.length / APP.limitPerPage);
}

function changePage(delta: number) {
    if (delta > 0 && APP.currentPage >= getMaxPages()) return;
    if (delta < 0 && APP.currentPage <= 1) return;

    APP.currentPage += delta;
    displayChat();
}

function prevPage() {
    changePage(-1);
}

function nextPage() {
    changePage(1);
}

function updatePageIndicator() {
    const indicator = document.getElementById('page-indicator');
    if (!indicator) return;

    indicator.textContent = `Page ${APP.currentPage}/${getMaxPages()}`;
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

    APP.filteredChats = APP.allChats.slice();
}

(async () => {
    const filePicker = document.getElementById('json-file');
    if (!filePicker || !(filePicker instanceof HTMLInputElement)) throw new Error('File element not found');

    const prevPageBtn = document.getElementById('prev-page');
    if (!prevPageBtn || !(prevPageBtn instanceof HTMLButtonElement)) throw new Error('Prev page button not found');
    prevPageBtn.addEventListener('click', prevPage, false);

    const nextPageBtn = document.getElementById('next-page');
    if (!nextPageBtn || !(nextPageBtn instanceof HTMLButtonElement)) throw new Error('Next page button not found');
    nextPageBtn.addEventListener('click', nextPage, false);

    const filtersForm = document.getElementById('filter-form');
    if (!filtersForm || !(filtersForm instanceof HTMLFormElement)) throw new Error('Filters form not found');
    filtersForm.addEventListener('submit', filterChat, false);

    const viewStatsBtn = document.getElementById('view-stats');
    if (!viewStatsBtn || !(viewStatsBtn instanceof HTMLButtonElement)) throw new Error('View stats button not found');
    viewStatsBtn.addEventListener('click', () => {
        const statsDialog = document.getElementById('stats');
        if (statsDialog) {
            if (statsDialog.style.display === 'block') {
                statsDialog.style.display = 'none';
            } else {
                statsDialog.style.display = 'block';
            }
        }
    }, false);

    const closeStatsBtn = document.getElementById('close-stats');
    if (!closeStatsBtn || !(closeStatsBtn instanceof HTMLButtonElement)) throw new Error('Close stats button not found');
    closeStatsBtn.addEventListener('click', () => {
        const statsDialog = document.getElementById('stats');
        if (statsDialog) statsDialog.style.display = 'none';
    }, false);

    filePicker.addEventListener('change', () => {
        clearChat();
        clearErrorMsg();
        if (!filePicker.files || !filePicker.files.length) return;

        const file = filePicker.files[0];
        if (file.type !== 'application/json') return setErrorMsg('Error: Please choose a JSON file');

        processJsonFile(file).then(() => {
            displayChat();
            updateStatsDialog();
        });
    }, false);
})().catch((err) => {
    if (!err) return;
    if (err && typeof err.message === 'string') setErrorMsg(err.message);
    else setErrorMsg(err.toString());
});
