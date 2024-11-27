import { Context } from "@oak/oak";

import WebSocketChannel from "./WebSocketChannel.ts";

import { AppEvent, UserInfoWebSocket } from "../types/WebChannel.ts";
import {
    GameInfoWebSocket,
    receiveEvent,
    sendEvent,
} from "../types/GameChannel.ts";
import { UserInfo } from "../types/Generic.ts";

/**
 * @class GameChannel
 * Single channel to handle two players for a game
 */
export default class GameChannel extends WebSocketChannel {
    private requiredPlayer: UserInfo[];
    public isRoomFull = false;
    public createdAt = new Date();
    private onClose:VoidFunction;

    constructor(playerListIds: UserInfo[], roomId: string, onCloseCallback:VoidFunction) {
        super({
            prefix: "WS-GAME-" + roomId,
            type: null,
            withTimestamps: true,
        });
        this.onClose = onCloseCallback;
        this.clients = new Map<string, GameInfoWebSocket>();
        this.requiredPlayer = playerListIds;
    }

    /**
     * Check requirements and add user to channel
     * @param ctx
     * @returns
     */
    public override handleConnection(ctx: Context) {
        const id = ctx.request.url.searchParams.get("uid");
        const user = this.requiredPlayer.find((user) => user.id === id);
        // On interdit la connexion à la room sans id du joueur, sans les infos du joueurs, et si le joueur est déjà dans la room
        if (!id || !user || this.clients.has(id)) {
            return;
        }
        const newSocketId = super.handleConnection(ctx);
        const newSocket = this.clients.get(newSocketId!) as GameInfoWebSocket;
        newSocket.username = user.username;
        newSocket.id = id;
        this.clients.delete(newSocketId!);
        this.clients.set(id, newSocket);
    }

    /**
     * Method will be executed when client leave, propers cleanup
     * @param clientId
     */
    protected override onClientDisconnected(clientId: string): void {
        this.log(`${clientId} leaving`);
        this.clients.delete(clientId);
        this.isRoomFull = false;
        if (this.clients.keys().toArray().length === 0){
            this.close();
        }
        this.broadcastLobbyUsers();
    }

    /**
     * Method will be excuted when client join
     * @param emiterId
     */
    protected override onClientConnected(emiterId: string): void {
        this.log(`${emiterId} joining`);
        this.broadcastLobbyUsers();
        if (this.clients.keys().toArray().length === 2) {
            this.isRoomFull = true;
            this.broadcastAll({ event: sendEvent.askSelectionNumber });
        }
    }

    /**
     * Intercept any message from user in channel and redirect it to good method
     * @param m
     * @param emiterId
     * @returns
     */
    protected override onMessage(m: MessageEvent, emiterId: string): void {
        const messageEventParsed = JSON.parse(m.data) as AppEvent;
        this.log(`FROM ${emiterId} : ${JSON.stringify(messageEventParsed)}`);
        switch (messageEventParsed.event) {
            case receiveEvent.numberChosen:
                this.onNumberChosen(emiterId, messageEventParsed);
                break;
            case "retry":
                this.onRetry(emiterId, messageEventParsed);
                break;
            default:
                return;
        }
    }

    /**
     * Show a list of all users subscribe to channel
     */
    private broadcastLobbyUsers(): void {
        const users = [
            ...this.clients.entries().map((ews) => ({
                id: ews[0],
                username: (ews[1] as UserInfoWebSocket).username,
            })),
        ];
        super.broadcastAll({
            event: sendEvent.userUpdate,
            usernames: users,
        });
    }

    private onNumberChosen(emiterId: string, appEvent: AppEvent): void {
        this.log(`${emiterId} select : ${appEvent.choice}`);
        const socket = this.clients.get(emiterId) as GameInfoWebSocket;
        socket.choice = appEvent.choice;
        const playerIndex = this.requiredPlayer.findIndex((player) =>
            player.id === emiterId
        );
        if (playerIndex === -1) {
            return;
        }
        this.requiredPlayer[playerIndex].choice = appEvent.choice;
        this.clients.delete(emiterId);
        this.clients.set(emiterId, socket);
        const testIsAllPlayerPlayed = this.clients.entries().every((client) =>
            typeof (client[1] as GameInfoWebSocket).choice !== "undefined"
        );
        if (testIsAllPlayerPlayed) {
            this.log("Revealing...");
            this.broadcastAll({
                event: sendEvent.reveal,
                answers: this.requiredPlayer,
            });
        }
    }

    private onRetry(emiterId: string, appEvent: AppEvent): void {
        for (let index in this.requiredPlayer) {
            this.requiredPlayer[index].choice = undefined;
        }

        this.clients.entries().forEach((map) => {
            const socket = map[1] as GameInfoWebSocket;
            socket.choice = undefined;
            this.clients.set(map[0], socket);
        });

        this.broadcastAll({
            event: sendEvent.askSelectionNumber,
        });
    }

    private close(){
        this.clients.entries().forEach((mapItem) => mapItem[1].close());
        this.log('closing');
        this.onClose();
    }
}
