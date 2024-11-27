import { Context } from "@oak/oak";
import { LoggerService, LogOptionsParams } from "./logger.ts";
import { EnhancedWebsocket, AppEvent } from "../types/WebChannel.ts";

/**
 * @class WebSocketHandler
 * @extends LoggerService contain log utility functions
 * This class is use to handle basic case of a WebSocket like
 * Create a group of websocket join together into one broadcast channel,
 * Initialization content for websocket, and message utilities.
 */
export default abstract class WebSocketChannel extends LoggerService {
    protected clients: Map<string, EnhancedWebsocket>;

    constructor(logOptions? : LogOptionsParams){
        super(logOptions ?? {
            prefix : 'WS',
            type : null,
            withTimestamps : true,
        });
        this.clients = new Map<string, EnhancedWebsocket>();
    }

    /**
     * Will broadcast a given message to clients subscribe to this channel
     * @param message stringified json or message object
     * @param userId the emiter
     */
    protected broadcast(message: string|AppEvent, userId: string){
        this.log(`TO ${userId}, payload : ${typeof message !== 'string' ? JSON.stringify(message) : message}`)
        this.clients.get(userId)?.send(
            typeof message !== 'string' ? JSON.stringify(message) : message
        );
    }

    /**
     * Broadcast a message to all users subscribe to this channel
     * @param message 
     */
    protected broadcastAll(message: AppEvent){
        const messageString = JSON.stringify(message);
        for (const user of this.clients.entries()){
            this.broadcast(messageString, user[0]);
        }
    }

    /**
     * Do the subscription to a new user in the channel
     * @param ctx OakContext
     * @returns 
     */
    protected handleConnection(ctx: Context) : string|void {
        const socket:EnhancedWebsocket = ctx.upgrade() as EnhancedWebsocket;
        do {
            socket.id = crypto.randomUUID().replaceAll('-','').slice(0,8);
        } while (this.clients.has(socket.id));
        socket.onopen = () => this.onClientConnected(socket.id);
        socket.onclose = () => this.onClientDisconnected(socket.id);
        socket.onmessage = (m) => this.onMessage(m, socket.id);
        this.clients.set(socket.id, socket);
        return socket.id;
    } 

    /**
     * Callback method that will be execute when a user disconnect from this channel
     * @param clientId leaving channel 
    */
    protected abstract onClientDisconnected(clientId : string) : void;
    
    /**
     * Callback method that will be execute when a new user
     * subscribe to this channel
     * @param clientId joining channel 
     */
    protected abstract onClientConnected(clientId : string) : void;
    
    /**
     * Callback method that will be execute each time this 
     * channel receive a new message
     * @param m 
     */
    protected abstract onMessage(m:MessageEvent, emiterId: string) : void;
}




