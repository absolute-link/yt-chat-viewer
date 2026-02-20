import { YtCurrencyMap, CurrencyConversions } from './general';

export interface AppRunningStats {
    numChatMessages: number;
    numMemberChats: number;
    numModChats: number;
    numOwnerChats: number;
    numGreyChats: number;
    numGiftPurchases: number;
    totalGiftsPurchased: number;
    totalGiftsRedeemed: number;
    numMembershipJoins: number;
    numMilestoneMessages: number;
    numSuperchats: number;
    numSuperStickers: number;
    colourTotals: {
        [colour: string]: number;
    };
    currencyTotals: {
        [currency: string]: number;
    };
}

export interface AppUserStats {
    [userId: string]: {
        isMember: boolean;
        isMod: boolean;
        isOwner: boolean;
        firstMessageTime: string;
        lastMessageTime: string;
        numChatMessages: number;
        numGiftPurchases: number;
        totalGiftsPurchased: number;
        numSuperchats: number;
        numSuperStickers: number;
    }
}

export interface AppAggregateStats {
    chatsPerUser: number;
    pctMembers: number;
    pctMemberChats: number;
}

export interface ParsedChat {
    itemId: string;
    authorId?: string;
    offsetMsec: number;
    isDeleted: boolean;
    isTimedOut: boolean;
    isMember: boolean;
    isMod: boolean;
    isOwner: boolean;
    isSuperChat: boolean;
    isSuperSticker: boolean;
    superColour: string;
    superCurrency: string;
    superValue: number;
    isMembershipJoin: boolean;
    isMembershipMessage: boolean;
    isMembershipGift: boolean;
    numGiftsPurchased: number;
    isMembershipRedemption: boolean;
    isRaidBanner: boolean;
    userName: string;
    textContent: string;
    htmlLine: string;
}

export interface AppState {
    loadedFile: string;
    allChats: ParsedChat[];
    filteredChats: ParsedChat[];
    renderedChatIds: Set<string>;
    deletedChatIds: Set<string>;
    authorTimeouts: Map<string, number>;
    activeFilter: boolean;
    currentPage: number;
    limitPerPage: number;
    currencyMap: YtCurrencyMap;
    currencyConversions: CurrencyConversions;
    currenciesLoaded: boolean;
    allRunningStats: AppRunningStats;
    filteredRunningStats: AppRunningStats;
    userStats: AppUserStats;
    aggregateStats: AppAggregateStats;
}
