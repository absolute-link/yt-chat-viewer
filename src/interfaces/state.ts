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

export interface AppState {
    loadedFile: string;
    htmlLines: string[];
    currentPage: number;
    limitPerPage: number;
    runningStats: AppRunningStats;
    userStats: AppUserStats;
    aggregateStats: AppAggregateStats;
}
