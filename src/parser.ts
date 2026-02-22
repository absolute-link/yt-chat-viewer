import dayjs from 'dayjs';
import Duration from 'dayjs/plugin/duration.js';
import { User } from './interfaces/general';
import { AppState, Poll } from './interfaces/state';
import {
    AuthorInfo,
    SuperchatValue,
    RawBadge,
    RawChatEvent,
    RawEmoji,
    RawSuperchatRenderer,
    RawSuperStickerRenderer,
    RawRedirectRenderer,
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
        channelId: author.authorExternalChannelId,
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
    const sign = (msec < 0) ? '-' : '';
    const absMsec = Math.abs(msec);
    const fmt = (absMsec > 3600000) ? 'H:mm:ss' : 'mm:ss';

    const offsetStr = dayjs.duration(absMsec).format(fmt);
    const html = `<span class="time offset">${sign}${offsetStr}</span>`;
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

function makeRedirectBannerSpan(redirectRenderer: RawRedirectRenderer) {
    const bannerCommand = redirectRenderer.inlineActionButton?.buttonRenderer.command;
    const bannerUrl = bannerCommand?.watchEndpoint?.videoId ? `https://www.youtube.com/watch?v=${bannerCommand.watchEndpoint.videoId}` : '';

    let html = `<span class="banner redirect-banner">`;
    if (bannerUrl) {
        html += `<a href="${bannerUrl}" target="_blank">${simplifyText(redirectRenderer.bannerMessage)}</a>`;
    } else {
        html += simplifyText(redirectRenderer.bannerMessage);
    }
    html += '</span>';

    return html;
}

function makePollStart(poll: Poll) {
    let html = `<span class="banner poll-start">`;
    html += '<span class="poll-header">Poll:</span> ';
    html += `<span class="poll-question">${poll.question}</span>`;
    html += '<ul class="poll-choices">';
    for (const choice of poll.choices) {
        html += `<li>${choice.text}</li>`;
    }
    html += '</ul>';
    html += '</span>';

    return html;
}

function makePollEnd(poll: Poll) {
    let html = `<span class="banner poll-end">`;
    html += `<span class="poll-header">Poll Complete: <span class="vote-count">${poll.numVotes}</span> votes</span>`;
    html += `<span class="poll-question">${poll.question}</span>`;
    html += '<ul class="poll-choices">';
    for (const choice of poll.choices) {
        html += `<li>${choice.text}</li>`;
    }
    html += '</ul>';
    html += '<ul class="poll-choice-results">';
    for (const choice of poll.choices) {
        const voteEstimate = Math.round((choice.percentage / 100) * poll.numVotes);
        const roundedPercentage = Math.round(choice.percentage * 100) / 100;
        html += `<li><span class="vote-count">${voteEstimate}</span> votes (${roundedPercentage}%)</li>`;
    }
    html += '</ul>';
    html += '</span>';

    return html;
}

export function processChatEvent(app: AppState, msgData: RawChatEvent) {
    const firstAction = msgData.replayChatItemAction?.actions[0];
    if (firstAction?.addChatItemAction?.item) {
        return processChatMessage(app, msgData);
    } else if (firstAction?.addBannerToLiveChatCommand) {
        return processChatBanner(app, msgData);
    } else if (firstAction?.removeChatItemAction || firstAction?.removeChatItemByAuthorAction) {
        return processMessageRemoval(app, msgData);
    } else if (firstAction?.showLiveChatActionPanelAction || firstAction?.updateLiveChatPollAction) {
        return processPollUpdate(app, msgData);
    } else if (firstAction?.closeLiveChatActionPanelAction || firstAction?.removeBannerForLiveChatCommand) {
        return processPollCompletion(app, msgData);
    }
    return false;
}

function processChatMessage(app: AppState, msgData: RawChatEvent) {
    const actionItem = msgData.replayChatItemAction?.actions[0].addChatItemAction?.item;
    if (!actionItem) return false;

    // TODO: enter absolute timestamps, and allow choosing the type to display (or maybe just have them on hover)

    // TODO: for each custom emote found, load it ahead of time so the browser can cache it

    // TODO: can we see pinned chat events?

    // TODO: track some user-specific stats
        // first message for user (visible), number of messages from this user (on hover or out of the way), total messages, total unique users, avg messages per user, messages per minute

    let user: User;
    let itemId = '';
    let textContent = '';
    let msgSpanHtml = '';
    let isSuperChat = false;
    let isSuperSticker = false;
    let superColour = '';
    let superCurrency = '';
    let superValue = 0.0;
    let isMembershipJoin = false;
    let isMembershipMessage = false;
    let isMembershipGift = false;
    let numGiftsPurchased = 0;
    let isMembershipRedemption = false;

    if (actionItem.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer) {
        const topRenderer = actionItem.liveChatSponsorshipsGiftPurchaseAnnouncementRenderer;
        const subRenderer = topRenderer.header.liveChatSponsorshipsHeaderRenderer;
        subRenderer.authorExternalChannelId = topRenderer.authorExternalChannelId;
        itemId = topRenderer.id;
        isMembershipGift = true;
        numGiftsPurchased = parseInt((subRenderer.primaryText.runs || [])[1].text || '0');
        user = userFromAuthorInfo(subRenderer);
        msgSpanHtml += makeGiftMessageSpan(subRenderer.primaryText);
    } else if (actionItem.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer) {
        const renderer = actionItem.liveChatSponsorshipsGiftRedemptionAnnouncementRenderer;
        itemId = renderer.id;
        user = userFromAuthorInfo(renderer);
        msgSpanHtml += makeMessageSpan(renderer.message, ['membership-received', 'system-message']);
        textContent = simplifyText(renderer.message || '');
        isMembershipRedemption = true;
    } else if (actionItem.liveChatMembershipItemRenderer) {
        const renderer = actionItem.liveChatMembershipItemRenderer;
        itemId = renderer.id;
        user = userFromAuthorInfo(renderer);
        if (renderer.message) {
            // TODO: what does it look like if someone sends one without a message?
            msgSpanHtml += makeMemberMessageSpan(renderer.headerPrimaryText, renderer.message);
            textContent = simplifyText(renderer.message);
            isMembershipMessage = true;
        } else {
            msgSpanHtml += makeMessageSpan(renderer.headerSubtext, ['membership-join', 'system-message']);
            textContent = simplifyText(renderer.headerSubtext || '');
            isMembershipJoin = true;
        }
    } else if (actionItem.liveChatPaidMessageRenderer) {
        const renderer = actionItem.liveChatPaidMessageRenderer;
        const { currencyLabel, amount } = superchatValueFromRaw(renderer.purchaseAmountText);
        itemId = renderer.id;
        superColour = colourClassFromRaw(renderer.bodyBackgroundColor);
        superValue = amount;
        superCurrency = currencyLabel;
        isSuperChat = true;

        user = userFromAuthorInfo(renderer);
        msgSpanHtml += makeSuperChatSpan(renderer, superColour);
        textContent = simplifyText(renderer.message || '');
    } else if (actionItem.liveChatPaidStickerRenderer) {
        const renderer = actionItem.liveChatPaidStickerRenderer;
        const { currencyLabel, amount } = superchatValueFromRaw(renderer.purchaseAmountText);
        itemId = renderer.id;
        superColour = colourClassFromRaw(renderer.backgroundColor);
        superValue = amount;
        superCurrency = currencyLabel;
        isSuperSticker = true;

        user = userFromAuthorInfo(renderer);
        msgSpanHtml += makeStickerSpan(renderer, superColour);
    } else if (actionItem.liveChatTextMessageRenderer) {
        const renderer = actionItem.liveChatTextMessageRenderer;
        itemId = renderer.id;
        user = userFromAuthorInfo(renderer);
        msgSpanHtml += makeMessageSpan(renderer.message);
        textContent = simplifyText(renderer.message || '');
    } else {
        return false;
    }

    // skip duplicates that can happen when there's lag while live downloading
    if (app.renderedChatIds.has(itemId)) {
        return false;
    }

    const offsetMsecStr = msgData.replayChatItemAction?.videoOffsetTimeMsec || msgData.videoOffsetTimeMsec || '0';
    const offsetMsecInt = parseInt(offsetMsecStr, 10) || 0;

    const isDeleted = app.deletedChatIds.has(itemId);
    const authorTimeout = app.authorTimeouts.get(user.channelId || '');
    const isTimedOut = !!(authorTimeout && offsetMsecInt < authorTimeout);

    let lineHtml = '';
    lineHtml += makeTimeOffsetSpan(offsetMsecStr);
    lineHtml += makeUserSpan(user);
    lineHtml += msgSpanHtml;

    app.allChats.push({
        itemId,
        authorId: user.channelId,
        offsetMsec: offsetMsecInt,
        isDeleted,
        isTimedOut,
        isMember: user.isMember,
        isMod: user.isMod,
        isOwner: user.isOwner,
        isSuperChat,
        isSuperSticker,
        superColour,
        superCurrency,
        superValue,
        isMembershipJoin,
        isMembershipMessage,
        isMembershipGift,
        numGiftsPurchased,
        isMembershipRedemption,
        isRaidBanner: false,
        isPollStart: false,
        isPollEnd: false,
        userName: user.name,
        textContent,
        htmlLine: lineHtml,
    });
    app.renderedChatIds.add(itemId);

    return true;
}

function processChatBanner(app: AppState, msgData: RawChatEvent) {
    const bannerRenderer = msgData.replayChatItemAction?.actions[0].addBannerToLiveChatCommand?.bannerRenderer.liveChatBannerRenderer;
    if (!bannerRenderer) return false;

    const redirectRenderer = bannerRenderer.contents.liveChatBannerRedirectRenderer;
    if (!redirectRenderer) return false;

    const itemId = bannerRenderer.actionId;
    const offsetMsecStr = msgData.replayChatItemAction?.videoOffsetTimeMsec || msgData.videoOffsetTimeMsec || '0';

    // skip duplicates that can happen when there's lag while live downloading
    if (app.renderedChatIds.has(itemId)) {
        return false;
    }

    let lineHtml = '';
    lineHtml += makeTimeOffsetSpan(offsetMsecStr);
    lineHtml += makeRedirectBannerSpan(redirectRenderer);

    app.allChats.push({
        itemId,
        offsetMsec: parseInt(offsetMsecStr, 10) || 0,
        isDeleted: false,
        isTimedOut: false,
        isMember: false,
        isMod: false,
        isOwner: false,
        isSuperChat: false,
        isSuperSticker: false,
        superColour: '',
        superCurrency: '',
        superValue: 0.0,
        isMembershipJoin: false,
        isMembershipMessage: false,
        isMembershipGift: false,
        numGiftsPurchased: 0,
        isMembershipRedemption: false,
        isRaidBanner: true,
        isPollStart: false,
        isPollEnd: false,
        userName: '',
        textContent: simplifyText(redirectRenderer.bannerMessage),
        htmlLine: lineHtml,
    });
    app.renderedChatIds.add(itemId);

    return true;
}

function processPollUpdate(app: AppState, msgData: RawChatEvent) {
    const firstAction = msgData.replayChatItemAction?.actions[0];
    if (!firstAction) return false;

    const pollRenderer = firstAction.showLiveChatActionPanelAction?.panelToShow.liveChatActionPanelRenderer.contents.pollRenderer
        || firstAction.updateLiveChatPollAction?.pollToUpdate.pollRenderer;
    if (!pollRenderer) return false;

    const offsetMsecStr = msgData.videoOffsetTimeMsec || '0';
    const actionOffsetMsec = parseInt(offsetMsecStr, 10);

    const pollId = pollRenderer.liveChatPollId;
    const pollHeader = pollRenderer.header.pollHeaderRenderer;
    const pollMeta = simplifyText(pollHeader.metadataText);

    const numVotesMatch = pollMeta.match(/([0-9,]+) votes/i);
    const numVotes = (numVotesMatch) ? parseInt(numVotesMatch[1].replace(/,/g, ''), 10) : 0;

    const existingPoll = app.polls.get(pollId);
    if (existingPoll && existingPoll.lastUpdatedMsec <= actionOffsetMsec) {
        existingPoll.choices = pollRenderer.choices.map((choice) => ({
            text: simplifyText(choice.text),
            percentage: choice.voteRatio * 100,
        }));
        existingPoll.numVotes = numVotes;
        existingPoll.lastUpdatedMsec = actionOffsetMsec;
        return true;
    } else if (existingPoll) {
        return false;
    }

    const newPoll: Poll = {
        id: pollId,
        lastUpdatedMsec: actionOffsetMsec,
        completed: false,
        question: simplifyText(pollHeader.pollQuestion),
        numVotes: numVotes,
        choices: pollRenderer.choices.map((choice) => ({
            text: simplifyText(choice.text),
            percentage: choice.voteRatio * 100,
        })),
    };
    app.polls.set(pollId, newPoll);

    const choicesText = pollRenderer.choices.reduce((acc, choice) => {
        return `${acc}${simplifyText(choice.text)}\n`;
    }, '');

    let lineHtml = '';
    lineHtml += makeTimeOffsetSpan(offsetMsecStr);
    lineHtml += makePollStart(newPoll);

    app.allChats.push({
        itemId: pollId,
        offsetMsec: actionOffsetMsec,
        isDeleted: false,
        isTimedOut: false,
        isMember: false,
        isMod: false,
        isOwner: false,
        isSuperChat: false,
        isSuperSticker: false,
        superColour: '',
        superCurrency: '',
        superValue: 0.0,
        isMembershipJoin: false,
        isMembershipMessage: false,
        isMembershipGift: false,
        numGiftsPurchased: 0,
        isMembershipRedemption: false,
        isRaidBanner: false,
        isPollStart: true,
        isPollEnd: false,
        userName: '',
        textContent: `${simplifyText(pollHeader.pollQuestion)}\n${choicesText}`,
        htmlLine: lineHtml,
    });

    return true;
}

function processPollCompletion(app: AppState, msgData: RawChatEvent) {
    const firstAction = msgData.replayChatItemAction?.actions[0];
    if (!firstAction) return false;

    const pollId = firstAction.closeLiveChatActionPanelAction?.targetPanelId
        || firstAction.removeBannerForLiveChatCommand?.targetActionId;
    if (!pollId) return false;

    const existingPoll = app.polls.get(pollId);
    if (!existingPoll) return false;
    if (existingPoll.completed) return false;

    existingPoll.completed = true;
    existingPoll.choices.sort((a, b) => b.percentage - a.percentage);

    const offsetMsecStr = msgData.videoOffsetTimeMsec || '0';
    const actionOffsetMsec = parseInt(offsetMsecStr, 10);
    const choicesText = existingPoll.choices.reduce((acc, choice) => {
        return `${acc}${choice.text}\n`;
    }, '');

    let lineHtml = '';
    lineHtml += makeTimeOffsetSpan(offsetMsecStr);
    lineHtml += makePollEnd(existingPoll);

    app.allChats.push({
        itemId: pollId,
        offsetMsec: actionOffsetMsec,
        isDeleted: false,
        isTimedOut: false,
        isMember: false,
        isMod: false,
        isOwner: false,
        isSuperChat: false,
        isSuperSticker: false,
        superColour: '',
        superCurrency: '',
        superValue: 0.0,
        isMembershipJoin: false,
        isMembershipMessage: false,
        isMembershipGift: false,
        numGiftsPurchased: 0,
        isMembershipRedemption: false,
        isRaidBanner: false,
        isPollStart: false,
        isPollEnd: true,
        userName: '',
        textContent: `${existingPoll.question}\n${choicesText}`,
        htmlLine: lineHtml,
    });

    return true;
}

function processMessageRemoval(app: AppState, msgData: RawChatEvent) {
    const removalOffsetMsec = parseInt(msgData.videoOffsetTimeMsec || '0', 10);
    const targetChatId = msgData.replayChatItemAction?.actions[0].removeChatItemAction?.targetItemId;
    const targetChannelId = msgData.replayChatItemAction?.actions[0].removeChatItemByAuthorAction?.externalChannelId;

    if (!targetChatId && !targetChannelId) return false;
    if (targetChatId && app.deletedChatIds.has(targetChatId)) return true;

    for (const chat of app.allChats) {
        if (targetChatId && chat.itemId === targetChatId) {
            chat.isDeleted = true;
        } else if (targetChannelId && chat.authorId === targetChannelId && chat.offsetMsec <= removalOffsetMsec) {
            chat.isDeleted = true;
            chat.isTimedOut = true;
            app.deletedChatIds.add(chat.itemId);
        }
    }

    if (targetChatId) {
        app.deletedChatIds.add(targetChatId);
    }
    if (targetChannelId) {
        const existingTimeout = app.authorTimeouts.get(targetChannelId);
        if (!existingTimeout || existingTimeout < removalOffsetMsec) {
            app.authorTimeouts.set(targetChannelId, removalOffsetMsec);
        }
    }
    return true;
}
