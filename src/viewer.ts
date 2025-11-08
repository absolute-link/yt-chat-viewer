import { setErrorMsg, clearErrorMsg } from './errors';
import { getChunksToLinesTransform } from './lines';
import { RawChatEvent } from './interfaces/yt';
import { AppState, AppRunningStats, AppUserStats, AppAggregateStats, ParsedChat } from './interfaces/state';
import { processChatMessage } from './parser';
import { loadCurrencyConversions, getYtCurrencyMap, currencyCodeFromYtLabel } from './currency';

const APP: AppState = {
    loadedFile: '',
    allChats: [],
    filteredChats: [],
    activeFilter: false,
    currentPage: 1,
    limitPerPage: 1500,
    currencyMap: getYtCurrencyMap(),
    currenciesLoaded: false,
    currencyConversions: {},
    allRunningStats: freshRunningStats(),
    filteredRunningStats: freshRunningStats(),
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
    const rounded = Math.round(value * 100) / 100;
    return rounded;
}

function newStatsRow(label: string, allValue: string | number, filteredValue: string | number) {
    const rowEl = document.createElement('div');
    rowEl.className = 'stats-row';
    rowEl.innerHTML = `<span class="label">${label}</span><span class="value all">${allValue}</span><span class="value filtered">${filteredValue}</span>`;
    return rowEl;
}

function calculateRunningStats(chats: ParsedChat[]): AppRunningStats {
    const stats = freshRunningStats();

    for (const chat of chats) {
        stats.numChatMessages++;

        if (chat.isMember) stats.numMemberChats++;
        else stats.numGreyChats++;

        if (chat.isMod) stats.numModChats++;
        if (chat.isOwner) stats.numOwnerChats++;

        if (chat.isMembershipJoin) stats.numMembershipJoins++;
        if (chat.isMembershipMessage) stats.numMilestoneMessages++;
        if (chat.isMembershipRedemption) stats.totalGiftsRedeemed++;

        if (chat.isMembershipGift) {
            stats.numGiftPurchases++;
            stats.totalGiftsPurchased += chat.numGiftsPurchased;
        }
        if (chat.isSuperChat || chat.isSuperSticker) {
            if (chat.isSuperChat) stats.numSuperchats++;
            if (chat.isSuperSticker) stats.numSuperStickers++;

            if (!stats.colourTotals[chat.superColour]) stats.colourTotals[chat.superColour] = 0;
            stats.colourTotals[chat.superColour]++;

            if (!stats.currencyTotals[chat.superCurrency]) stats.currencyTotals[chat.superCurrency] = 0.0;
            stats.currencyTotals[chat.superCurrency] += chat.superValue;
        }
    }

    return stats;
}

function updateStatsDialog() {
    const statsDialog = document.getElementById('stats');
    if (!statsDialog) throw new Error('Stats dialog not found');

    const generalBody = document.getElementById('general-stats-body');
    if (!generalBody) throw new Error('General stats body not found');

    const monetizationBody = document.getElementById('monetization-stats-body');
    if (!monetizationBody) throw new Error('Monetization stats body not found');

    const currencyBody = document.getElementById('currency-stats-body');
    if (!currencyBody) throw new Error('Currency stats body not found');

    const estimateUSDAllSpan = document.getElementById('estimate-usd-all');
    const estimateUSDFilteredSpan = document.getElementById('estimate-usd-filtered');
    if (!estimateUSDAllSpan || !estimateUSDFilteredSpan) throw new Error('USD estimate spans not found');

    if (APP.activeFilter) {
        statsDialog.classList.add('filtered');
        statsDialog.classList.remove('unfiltered');
    } else {
        statsDialog.classList.add('unfiltered');
        statsDialog.classList.remove('filtered');
    }

    const allStats = APP.allRunningStats;
    const filteredStats = APP.filteredRunningStats;

    generalBody.innerHTML = '';
    monetizationBody.innerHTML = '';
    currencyBody.innerHTML = '';

    const generalStats: [string, number, number][] = [
        ['Total Messages', allStats.numChatMessages, filteredStats.numChatMessages],
        ['Member Chats', allStats.numMemberChats, filteredStats.numMemberChats],
        ['Non-Member Chats', allStats.numGreyChats, filteredStats.numGreyChats],
        ['Moderator Chats', allStats.numModChats, filteredStats.numModChats],
        ['Owner Chats', allStats.numOwnerChats, filteredStats.numOwnerChats],
        ['Membership Joins', allStats.numMembershipJoins, filteredStats.numMembershipJoins],
        ['Milestone Messages', allStats.numMilestoneMessages, filteredStats.numMilestoneMessages],
    ];

    const monetizationStats: [string, number, number][] = [
        ['Number of Member Gifts', allStats.numGiftPurchases, filteredStats.numGiftPurchases],
        ['Total Memberships Gifted', allStats.totalGiftsPurchased, filteredStats.totalGiftsPurchased],
        ['Membership Gifts Redeemed', allStats.totalGiftsRedeemed, filteredStats.totalGiftsRedeemed],
        ['Total Super Chats', allStats.numSuperchats, filteredStats.numSuperchats],
        ['Total Super Stickers', allStats.numSuperStickers, filteredStats.numSuperStickers],
    ];
    for (const [colour, allCount] of Object.entries(allStats.colourTotals)) {
        const filteredCount = filteredStats.colourTotals[colour] || 0;
        monetizationStats.push([`${humanizeColour(colour)} SC / SS`, allCount, filteredCount]);
    }

    let totalEstimateUSD = 0.0;
    let filteredEstimateUSD = 0.0;
    const currencyStats: [string, number, number][] = [];

    for (const [currencyLabel, allTotal] of Object.entries(allStats.currencyTotals)) {
        const realCurrencyCode = currencyCodeFromYtLabel(currencyLabel);
        const visualLabel = (realCurrencyCode !== currencyLabel) ? `${currencyLabel} <span class="real-currency">(${realCurrencyCode})</span>` : currencyLabel;
        const filteredTotal = filteredStats.currencyTotals[currencyLabel] || 0;

        currencyStats.push([`${visualLabel}`, roundCurrency(allTotal), roundCurrency(filteredTotal)]);

        if (APP.currenciesLoaded && APP.currencyConversions && currencyLabel in APP.currencyConversions) {
            const rate = APP.currencyConversions[currencyLabel];
            totalEstimateUSD += allTotal * rate;
            filteredEstimateUSD += filteredTotal * rate;
        }
    }

    for (const [label, allValue, filteredValue] of generalStats) {
        generalBody.appendChild(newStatsRow(label, allValue, filteredValue));
    }
    for (const [label, allValue, filteredValue] of monetizationStats) {
        monetizationBody.appendChild(newStatsRow(label, allValue, filteredValue));
    }

    if (APP.currenciesLoaded) {
        estimateUSDAllSpan.textContent = roundCurrency(totalEstimateUSD).toString();
        estimateUSDFilteredSpan.textContent = roundCurrency(filteredEstimateUSD).toString();
    }

    for (const [label, allValue, filteredValue] of currencyStats) {
        currencyBody.appendChild(newStatsRow(label, allValue, filteredValue));
    }
}

function clearChat() {
    APP.loadedFile = '';
    APP.allChats = [];
    APP.filteredChats = [];
    APP.activeFilter = false;
    APP.currentPage = 1;
    APP.allRunningStats = freshRunningStats();
    APP.filteredRunningStats = freshRunningStats();
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

    if (typeDropdown.value === '' && textSearchBox.value.trim() === '') {
        console.log('no filter');
        APP.activeFilter = false;
        APP.filteredChats = APP.allChats.slice();
        APP.currentPage = 1;
        APP.filteredRunningStats = APP.allRunningStats;
        updateStatsDialog();
        displayChat();
        return;
    }

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

    APP.activeFilter = true;
    APP.currentPage = 1;
    APP.filteredRunningStats = calculateRunningStats(APP.filteredChats);
    updateStatsDialog();
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
    const loadingIcon = document.getElementById('loading-icon');
    if (!loadingIcon) throw new Error('Loading icon element not found');

    const filePicker = document.getElementById('json-file');
    if (!filePicker || !(filePicker instanceof HTMLInputElement)) throw new Error('File element not found');

    const urlDisplay = document.getElementById('url-display');
    if (!urlDisplay) throw new Error('URL display element not found');

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

    const statsDialog = document.getElementById('stats');
    if (!statsDialog) throw new Error('Stats dialog not found');

    const statsShade = document.getElementById('stats-shade');
    if (!statsShade) throw new Error('Stats shade not found');

    const closeStatsBtn = document.getElementById('close-stats');
    if (!closeStatsBtn || !(closeStatsBtn instanceof HTMLButtonElement)) throw new Error('Close stats button not found');

    const loadCurrenciesBtn = document.getElementById('load-currencies');
    if (!loadCurrenciesBtn || !(loadCurrenciesBtn instanceof HTMLButtonElement)) throw new Error('Load currencies button not found');

    // start with zeroed stats
    updateStatsDialog();

    viewStatsBtn.addEventListener('click', () => {
        if (statsDialog.style.display === 'block') {
            statsDialog.style.display = 'none';
            statsShade.style.display = 'none';
        } else {
            statsDialog.style.display = 'block';
            statsShade.style.display = 'block';
            scrollTo(0, 0);
        }
    }, false);

    statsShade.addEventListener('click', () => {
        statsDialog.style.display = 'none';
        statsShade.style.display = 'none';
    }, false);

    closeStatsBtn.addEventListener('click', () => {
        statsDialog.style.display = 'none';
        statsShade.style.display = 'none';
    }, false);

    loadCurrenciesBtn.addEventListener('click', async () => {
        if (APP.currenciesLoaded) return;

        const estimateUSDAllSpan = document.getElementById('estimate-usd-all');
        const estimateUSDFilteredSpan = document.getElementById('estimate-usd-filtered');
        if (!estimateUSDAllSpan || !estimateUSDFilteredSpan) throw new Error('USD estimate spans not found');

        estimateUSDAllSpan.innerHTML = '•••';
        estimateUSDFilteredSpan.innerHTML = '•••';

        APP.currencyConversions = await loadCurrencyConversions();
        APP.currenciesLoaded = true;
        updateStatsDialog();
    }, false);

    filePicker.addEventListener('change', async () => {
        clearChat();
        clearErrorMsg();
        if (!filePicker.files || !filePicker.files.length) return;

        const file = filePicker.files[0];
        if (file.type !== 'application/json') return setErrorMsg('Error: Please choose a JSON file');

        loadingIcon.style.display = 'block';
        await processJsonFile(file);
        loadingIcon.style.display = 'none';

        displayChat();
        APP.allRunningStats = calculateRunningStats(APP.allChats);
        APP.filteredRunningStats = APP.allRunningStats;
        updateStatsDialog();
    }, false);

    if (window.location.search) {
        const params = new URLSearchParams(window.location.search);
        const chatFileUrl = params.get('chatFile');
        if (chatFileUrl) {
            filePicker.style.display = 'none';
            urlDisplay.style.display = 'block';
            urlDisplay.textContent = `Chat File: ${chatFileUrl}`;
            loadingIcon.style.display = 'block';

            const response = await fetch(chatFileUrl);
            if (!response.ok) throw new Error('Failed to load chat file from URL');

            const blob = await response.blob();
            if (blob.type !== 'application/json') throw new Error('Error: Please provide a JSON file');

            await processJsonFile(new File([blob], 'chat.json', { type: 'application/json' }));

            loadingIcon.style.display = 'none';
            displayChat();
            APP.allRunningStats = calculateRunningStats(APP.allChats);
            APP.filteredRunningStats = APP.allRunningStats;
            updateStatsDialog();
        }
    }
})().catch((err) => {
    if (!err) return;
    if (err && typeof err.message === 'string') setErrorMsg(err.message);
    else setErrorMsg(err.toString());
});
