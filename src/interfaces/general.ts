export interface User {
    channelId: string;
    isMember: boolean;
    isMod: boolean;
    isOwner: boolean;
    cssClasses: string[];
    name: string;
}
