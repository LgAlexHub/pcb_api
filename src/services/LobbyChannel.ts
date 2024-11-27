import { Context } from "https://jsr.io/@oak/oak/17.1.3/context.ts";
import WebSocketChannel from "./WebSocketChannel.ts";
import {
    AppEvent,
    receiveEvent,
    Room,
    sendEvent,
    UserInfoWebSocket,
} from "../types/WebChannel.ts";

/**
 * @class LobbyChannel
 * @extends WebSocketChannel basic utility methods for group of websockets
 * Entry point to all user before joining a game channel
 */
export default class LobbyChannel extends WebSocketChannel {
    public pendingInvites: Room[];

    constructor() {
        super({
            prefix : 'WS-LOBBY',
            type : null,
            withTimestamps : true,
        });
        this.pendingInvites = [];
    }

    /**
     * @override
     * Handle a new user in LobbyChannel
     * @param ctx
     */
    public override handleConnection(ctx: Context): string | void {
        const username = ctx.request.url.searchParams.get("username")
            ? ctx.request.url.searchParams.get("username")!
            : "AnonymousGuest";
        const newSocketId = super.handleConnection(ctx);
        const newSocket = this.clients.get(newSocketId!) as UserInfoWebSocket;
        newSocket.username = username;
        this.clients.set(newSocketId!, newSocket);
    }

    /**
     * Handle when client leaving lobby channel
     * @param clientId
     */
    protected override onClientDisconnected(clientId: string): void {
        this.clients.delete(clientId);
        this.broadcastLobbyUsers();
    }

    /**
     * Handle a new client in lobby channel
     * @param clientId
     */
    protected override onClientConnected(clientId: string): void {
        this.broadcastLobbyUsers();
        this.broadcast({
            event: sendEvent.userRegistrated,
            id: clientId,
        }, clientId);
    }

    /**
     * Channel event entry point
     * @param m
     * @param emiterId
     * @returns
     */
    protected override onMessage(m: MessageEvent, emiterId: string): void {
        const messageEventParsed = JSON.parse(m.data) as AppEvent;
        this.log(`FROM ${emiterId} : ${JSON.stringify(messageEventParsed)}`)
        switch (messageEventParsed.event) {
            case receiveEvent.newChat:
                this.onNewTextChat(emiterId, messageEventParsed);
                break;
            case receiveEvent.newInvite:
                this.onNewInvite(emiterId, messageEventParsed);
                break;
            case receiveEvent.handleInvite:
                this.onHandleInvite(emiterId, messageEventParsed);
                break;
            default:
                return;
        }
    }

    /**
     * Handle an invite answer
     * @param emiterId
     * @param appEvent
     * @returns
     */
    private onHandleInvite(emiterId: string, appEvent: AppEvent): void {
        const inviteSentIndex = this.pendingInvites.findIndex((invite) =>
            invite.u2.id === emiterId
        );
        if (inviteSentIndex === -1) {
            return;
        }

        if (!appEvent.answer) {
            this.pendingInvites.slice(inviteSentIndex, 1);
            this.broadcast({
                event: sendEvent.userRefusedInvite,
            }, appEvent.from);
        } else {
            this.pendingInvites[inviteSentIndex].accepted = true;
            [
                this.pendingInvites[inviteSentIndex].u1,
                this.pendingInvites[inviteSentIndex].u2,
            ].forEach((user) =>
                this.broadcast({
                    event: sendEvent.userMoveToGame,
                    roomId: this.pendingInvites[inviteSentIndex].roomId,
                }, user.id)
            );
        }
    }

    /**
     * Handle a new text chat
     * @param emiterId
     * @param appEvent
     */
    private onNewTextChat(emiterId: string, appEvent: AppEvent): void {
        this.broadcastAll({
            event: sendEvent.userNewMessage,
            username: `${emiterId}#${
                (this.clients.get(emiterId) as UserInfoWebSocket).username
            }`,
            message: appEvent.message,
        });
    }

    /**
     * Handle a new invite demand
     * @param emiterId
     * @param appEvent
     * @returns
     */
    private onNewInvite(emiterId: string, appEvent: AppEvent): void {
        if (
            emiterId === appEvent.targetUser ||
            !this.clients.has(appEvent.targetUser)
        ) {
            return; // On ne lance pas d'invite si c'est soit même la cible ou si la cible n'existe pas
        }
        this.broadcast(
            { event: sendEvent.userNewInvite, from: emiterId },
            appEvent.targetUser,
        );
        if (!this.pendingInvites.find((invite) => invite.u1.id === emiterId)) {
            this.pendingInvites.push({
                u1: {
                    id: emiterId,
                    username: (this.clients.get(emiterId) as UserInfoWebSocket)
                        .username,
                },
                u2: {
                    id: appEvent.targetUser,
                    username: (this.clients.get(
                        appEvent.targetUser,
                    ) as UserInfoWebSocket).username,
                },
                roomId: crypto.randomUUID(),
                accepted: false,
            });
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
            event: sendEvent.usersUpdate,
            usernames: users,
        });
    }
}
