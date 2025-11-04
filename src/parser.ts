import dayjs from 'dayjs';
import Duration from 'dayjs/plugin/duration.js';
import { User } from './interfaces/general';
import { AppState } from './interfaces/state';
import {
    AuthorInfo,
    SuperchatValue,
    RawBadge,
    RawChatEvent,
    RawEmoji,
    RawSuperchatRenderer,
    RawSuperStickerRenderer,
    RawTextData,
    RawThumbnail,
} from './interfaces/yt';

dayjs.extend(Duration);

interface ColourCache {
    [key: string]: string;
}

function colourClassFromRaw(backgroundColor: number) {
    const colourStr = backgroundColor.toString();
    const cache: ColourCache = {
        '4279592384': 'blue', // header/sticker
        '4280191205': 'blue', // body
        '4278237396': 'light-blue', // header/sticker
        '4278248959': 'light-blue', // body
        '4278239141': 'light-green', // header/sticker
        '4280150454': 'light-green', // body
        '4294947584': 'yellow', // header/sticker
        '4294953512': 'yellow', // body
        '4293284096': 'orange', // header/sticker
        '4294278144': 'orange', // body
        '4290910299': 'pink', // header/sticker
        '4293467747': 'pink', // body
        '4291821568': 'red', // header/sticker
        '4293271831': 'red', // body
    };

    if (cache[colourStr]) return cache[colourStr];
    return 'unknown';
}

function smallestThumbnail(thumbnails: RawThumbnail[]) {
    let smallest: RawThumbnail | null = null;
    for (const thumb of thumbnails) {
        if (!smallest) smallest = thumb;
        else if ((thumb.width || 0) < (smallest.width || 0)) smallest = thumb;
    }
    return smallest;
}

function makeEmojiHtml(emoji: RawEmoji) {
    if (emoji.isCustomEmoji) {
        const thumbnail = smallestThumbnail(emoji.image.thumbnails);
        if (thumbnail) {
            return `<img class="emoji" src="${thumbnail.url}" alt="${emoji.shortcuts[0] || ''}">`;
        } else {
            return `<span class="emoji-text">${emoji.shortcuts[0] || ''}</span>`;
        }
    }
    return emoji.emojiId;
}

function quickEncode(str: string) {
    return str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function simplifyText(textData: RawTextData | string) {
    if (typeof textData === 'string') return textData;

    if (textData.simpleText) {
        return textData.simpleText;
    } else if (textData.runs) {
        return textData.runs.map((run) => {
            if (run.text) return quickEncode(run.text);
            if (run.emoji) return makeEmojiHtml(run.emoji);
            return '';
        }).join('');
    }

    return '';
}

function superchatValueFromRaw(textData: RawTextData): SuperchatValue {
    const text = simplifyText(textData);
    const match = text.match(/^([^0-9.,]*)([0-9.,]+)/);
    if (match) return {
        currencyLabel: (match[1] || 'Unknown').trim(),
        amount: parseFloat(match[2].trim()),
    };
    return {
        currencyLabel: 'Unknown',
        amount: 0.0,
    };
}

function userFromAuthorInfo(author: AuthorInfo) {
    const user: User = {
        channelId: author.authorExternalChannelId || '',
        isMember: false,
        isMod: false,
        isOwner: false,
        cssClasses: [],
        name: simplifyText(author.authorName || '[Unknown Name]'),
    };

    for (const badge of (author.authorBadges || [])) {
        const tooltip = badge.liveChatAuthorBadgeRenderer.tooltip.toLowerCase();
        if (tooltip === 'owner') {
            user.isOwner = true;
            user.cssClasses.push('owner');
        } else if (tooltip === 'moderator') {
            user.isMod = true;
            user.cssClasses.push('mod');
        } else if (tooltip.startsWith('member') || tooltip === 'new member') {
            user.isMember = true;
            user.cssClasses.push('mem');
        }
    }

    return user;
}

function classNameFromBadge(badge: RawBadge) {
    const tooltip = badge.liveChatAuthorBadgeRenderer.tooltip.toLowerCase();
    if (tooltip === 'owner') return 'owner';
    if (tooltip === 'moderator') return 'mod';
    if (tooltip.startsWith('member') || tooltip === 'new member') return 'mem';
    return '';
}

function shortenMembershipLength(lengthText: RawTextData) {
    const simplified = simplifyText(lengthText);
    return simplified.replace(/^[^0-9]+/, '').replace(/months?/, 'mo').replace(/years?/, 'yr');
}

function makeTimeOffsetSpan(offsetMsec: string) {
    const msec = parseInt(offsetMsec, 10) || 0;
    const fmt = (msec > 3600000) ? 'H:mm:ss' : 'mm:ss';
    const offsetStr = dayjs.duration(msec).format(fmt);
    const html = `<span class="time offset">${offsetStr}</span>`;
    return html;
}

function makeUserSpan(user: User) {
    const userClass = ['user', ...user.cssClasses].join(' ');
    return `<span class="${userClass}">
            <a href="https://www.youtube.com/channel/${user.channelId}">${user.name}</a>
        </span>
    `;
}

function makeMessageSpan(textData?: RawTextData, additionalClasses: string[] = []) {
    const msgText = (textData) ? simplifyText(textData) : '';
    const classStr = ['msg', ...additionalClasses].join(' ');
    return `<span class="${classStr}">${msgText}</span>`;
}

function makeGiftMessageSpan(textData: RawTextData) {
    let html = '<span class="msg membership-gift system-message">';
    html += '<span class="gift-icon">🎁</span>';
    html += `<span class="text">${simplifyText(textData)}</span>`;
    html += '</span>';

    return html;
}

function makeMemberMessageSpan(lengthText: RawTextData, message: RawTextData) {
    let html = `<span class="msg membership-message">`;
    html += `<span class="mem-length">${shortenMembershipLength(lengthText)}</span>`;
    html += `<span class="text">${simplifyText(message)}</span>`;
    html += '</span>';

    return html;
}

function makeSuperChatSpan(renderer: RawSuperchatRenderer, scColour: string) {
    let html = `<span class="msg superchat ${scColour}">`;
    html += `<span class="money">${simplifyText(renderer.purchaseAmountText)}</span>`;
    if (renderer.message) html += `<span class="text">${simplifyText(renderer.message)}</span>`;
    html += '</span>';

    return html;
}

function makeStickerSpan(renderer: RawSuperStickerRenderer, scColour: string) {
    const thumbnail = smallestThumbnail(renderer.sticker.thumbnails);
    const alt = renderer.sticker.accessibility.accessibilityData.label;

    let html = `<span class="msg super-sticker ${scColour}">`;
    html += `<span class="money">${simplifyText(renderer.purchaseAmountText)}</span>`;
    if (thumbnail) html += `<img class="sticker" src="${thumbnail.url}" alt="${alt}">`;
    html += '</span>';

    return html;
}

export function processChatMessage(app: AppState, msgData: RawChatEvent) {
    const actionItem = msgData.replayChatItemAction?.actions[0].addChatItemAction?.item;
    if (!actionItem) return false;

    // TODO: enter absolute timestamps, and allow choosing the type to display

    // TODO: for each custom emote found, load it ahead of time so the browser can cache it

    // TODO: allow loading from a URL (e.g. Google Drive link), instead of just from a file
        // accept an encoded URL in query string param, so that chats can be bookmarked or even shared directly

    // TODO: we can see who the raid went to! check if this appears in VODs as well (msgData.replayChatItemAction?.actions[0].addBannerToLiveChatCommand)
    // TODO: removeChatItemByAuthorAction (does it have something above the actions? no ID within them)
    // TODO: removeChatItemAction (this does include a targetItemId)
    // TODO: maybe for deleted items, have them extremely faded

    // TODO: track as many stats as possible
        // first message for user (visible), number of messages from this user (on hover or out of the way), total messages, total unique users, avg messages per user, messages per minute
        // total channel emotes used, most used top three emotes, avg emotes used per user, avg emotes used per message, emotes per minute
        // total membership gifts given, membership gifts received, total joins and total upgrades, total milestone messages
        // superchat totals (number, per colour, totals per currency), maybe a button to use JS to reach out to an API to calculate it all in USD

    let user: User;
    let textContent = '';
    let msgSpanHtml = '';
    let isSuperChat = false;
    let isSuperSticker = false;
    let isMembershipMessage = false;
    let isMembershipGift = false;
    let isMembershipRedemption = false;

    if (actionItem.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer) {
        const topRenderer = actionItem.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer;
        const subRenderer = topRenderer.header.liveChatSponsorshipsHeaderRenderer;
        subRenderer.authorExternalChannelId = topRenderer.authorExternalChannelId;
        const giftCount = parseInt((subRenderer.primaryText.runs || [])[1].text || '0');
        user = userFromAuthorInfo(subRenderer);
        msgSpanHtml += makeGiftMessageSpan(subRenderer.primaryText);
        isMembershipGift = true;
        app.runningStats.numGiftPurchases++;
        app.runningStats.totalGiftsPurchased += giftCount;
    } else if (actionItem.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer) {
        const renderer = actionItem.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer;
        user = userFromAuthorInfo(renderer);
        msgSpanHtml += makeMessageSpan(renderer.message, ['membership-received', 'system-message']);
        isMembershipRedemption = true;
    } else if (actionItem.liveChatMembershipItemRenderer) {
        const renderer = actionItem.liveChatMembershipItemRenderer;
        user = userFromAuthorInfo(renderer);
        if (renderer.message) {
            // TODO: what does it look like if someone sends one without a message?
            msgSpanHtml += makeMemberMessageSpan(renderer.headerPrimaryText, renderer.message);
            textContent = simplifyText(renderer.message);
            app.runningStats.numMilestoneMessages++;
        } else {
            msgSpanHtml += makeMessageSpan(renderer.headerSubtext, ['membership-join', 'system-message']);
            app.runningStats.numMembershipJoins++;
        }
        isMembershipMessage = true;
    } else if (actionItem.liveChatPaidMessageRenderer) {
        const renderer = actionItem.liveChatPaidMessageRenderer;
        const scColour = colourClassFromRaw(renderer.bodyBackgroundColor);
        const { currencyLabel, amount: superChatValue } = superchatValueFromRaw(renderer.purchaseAmountText);
        user = userFromAuthorInfo(renderer);
        msgSpanHtml += makeSuperChatSpan(renderer, scColour);
        isSuperChat = true;
        textContent = simplifyText(renderer.message || '');

        app.runningStats.numSuperchats++;
        if (!app.runningStats.colourTotals[scColour]) app.runningStats.colourTotals[scColour] = 0;
        app.runningStats.colourTotals[scColour]++;
        if (!app.runningStats.currencyTotals[currencyLabel]) app.runningStats.currencyTotals[currencyLabel] = 0.0;
        app.runningStats.currencyTotals[currencyLabel] += superChatValue;
    } else if (actionItem.liveChatPaidStickerRenderer) {
        const renderer = actionItem.liveChatPaidStickerRenderer;
        const scColour = colourClassFromRaw(renderer.backgroundColor);
        const { currencyLabel, amount: superChatValue } = superchatValueFromRaw(renderer.purchaseAmountText);
        user = userFromAuthorInfo(renderer);
        msgSpanHtml += makeStickerSpan(renderer, scColour);
        isSuperSticker = true;
        app.runningStats.numSuperStickers++;
        if (!app.runningStats.colourTotals[scColour]) app.runningStats.colourTotals[scColour] = 0;
        app.runningStats.colourTotals[scColour]++;
        if (!app.runningStats.currencyTotals[currencyLabel]) app.runningStats.currencyTotals[currencyLabel] = 0.0;
        app.runningStats.currencyTotals[currencyLabel] += superChatValue;
    } else if (actionItem.liveChatTextMessageRenderer) {
        const renderer = actionItem.liveChatTextMessageRenderer;
        user = userFromAuthorInfo(renderer);
        msgSpanHtml += makeMessageSpan(renderer.message);
        textContent = simplifyText(renderer.message || '');
    } else {
        return false;
    }

    let lineHtml = '';
    lineHtml += makeTimeOffsetSpan(msgData.replayChatItemAction?.videoOffsetTimeMsec || '');
    lineHtml += makeUserSpan(user);
    lineHtml += msgSpanHtml;

    app.allChats.push({
        isMember: user.isMember,
        isMod: user.isMod,
        isOwner: user.isOwner,
        isSuperChat,
        isSuperSticker,
        isMembershipMessage,
        isMembershipGift,
        isMembershipRedemption,
        userName: user.name,
        textContent,
        htmlLine: lineHtml,
    });

    app.runningStats.numChatMessages++;
    if (user.isMember) app.runningStats.numMemberChats++;
    else app.runningStats.numGreyChats++;
    if (user.isMod) app.runningStats.numModChats++;
    if (user.isOwner) app.runningStats.numOwnerChats++;

    return true;
}
