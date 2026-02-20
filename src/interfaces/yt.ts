export interface RawThumbnail {
    url: string;
    width?: number;
    height?: number;
}

export interface RawAccessibility {
    accessibilityData: {
        label: string;
    }
}

export interface RawEmoji {
    emojiId: string;
    image: {
        accessibility: RawAccessibility;
        thumbnails: RawThumbnail[];
    };
    isCustomEmoji: boolean;
    searchTerms: string[];
    shortcuts: string[];
}

export interface RawTextData {
    simpleText?: string;
    runs?: {
        text?: string;
        emoji?: RawEmoji;
    }[];
}

export interface RawBadgeRenderer {
    accessibility: RawAccessibility;
    customThumbnail?: {
        thumbnails: RawThumbnail[];
    }
    icon?: {
        iconType: string;
    }
    tooltip: string;
}

export interface RawBadge {
    liveChatAuthorBadgeRenderer: RawBadgeRenderer;
}

export interface AuthorInfo {
    authorBadges?: RawBadge[];
    authorExternalChannelId?: string;
    authorName?: RawTextData;
    authorPhoto?: {
        thumbnails: RawThumbnail[];
    }
}

export interface SuperchatValue {
    currencyLabel: string;
    amount: number;
}

export interface RawMessageRenderer extends AuthorInfo {
    id: string;
    message?: RawTextData;
    timestampUsec: string;
}

export interface RawSuperchatRenderer extends RawMessageRenderer {
    bodyBackgroundColor: number;
    bodyTextColor: number;
    headerBackgroundColor: number;
    headerTextColor: number;
    purchaseAmountText: RawTextData;
}

export interface RawSuperStickerRenderer extends AuthorInfo {
    backgroundColor: number;
    id: string;
    moneyChipBackgroundColor: number;
    moneyChipTextColor: number;
    purchaseAmountText: RawTextData;
    sticker: {
        accessibility: RawAccessibility;
        thumbnails: RawThumbnail[];
    }
    stickerDisplayHeight: number;
    stickerDisplayWidth: number;
    timestampUsec: string;
}

export interface RawMembershipMessageRenderer extends RawMessageRenderer {
    headerPrimaryText: RawTextData; // "Member for 1 month"
    headerSubtext: RawTextData; // "[Member Tier name]" or "Welcome to [Member Tier name]!"
}

export interface RawGiftMembershipsHeaderRenderer extends AuthorInfo {
    primaryText: RawTextData;
}

export interface RawGiftMembershipsRenderer {
    id: string;
    authorExternalChannelId: string;
    header: {
        liveChatSponsorshipsHeaderRenderer: RawGiftMembershipsHeaderRenderer
    }
    timestampUsec: string;
}

export interface RawRedirectRenderer {
    bannerMessage: RawTextData;
    inlineActionButton?: {
        buttonRenderer: {
            text: RawTextData;
            command?: {
                urlEndpoint?: {
                    url: string;
                    target: string;
                }
                watchEndpoint?: {
                    videoId: string;
                }
            }
        }
    }
}

export interface RawBannerRenderer {
    actionId: string;
    bannerType: string;
    contents: {
        liveChatBannerRedirectRenderer?: RawRedirectRenderer;
    }
}

export interface RawChatEvent {
    isLive: boolean;
    videoOffsetTimeMsec?: string;
    replayChatItemAction?: {
        videoOffsetTimeMsec?: string;
        actions: {
            addChatItemAction?: {
                item: {
                    liveChatTextMessageRenderer?: RawMessageRenderer;
                    liveChatPaidMessageRenderer?: RawSuperchatRenderer;
                    liveChatPaidStickerRenderer?: RawSuperStickerRenderer;
                    liveChatMembershipItemRenderer?: RawMembershipMessageRenderer;
                    liveChatSponsorshipsGiftPurchaseAnnouncementRenderer?: RawGiftMembershipsRenderer;
                    liveChatSponsorshipsGiftRedemptionAnnouncementRenderer?: RawMessageRenderer;
                }
            }
            addBannerToLiveChatCommand?: {
                bannerRenderer: {
                    liveChatBannerRenderer: RawBannerRenderer;
                }
            }
            removeChatItemAction?: {
                targetItemId: string;
            }
            removeChatItemByAuthorAction?: {
                externalChannelId: string;
            }
        }[];
    }
}
