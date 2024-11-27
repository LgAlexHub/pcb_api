import { UserInfoWebSocket } from "./WebChannel.ts";

export enum sendEvent {
    userUpdate = 'user-update',
    askSelectionNumber = 'ask-number',
    reveal = 'reveal-choice'
};

export enum receiveEvent {
    numberChosen = 'number-picked',
}

export type GameInfoWebSocket = UserInfoWebSocket & {
    choice : number | undefined,
};