import { Context } from "@oak/oak";
import WebSocketChannel, { EnhancedWebsocket } from "./WebSocketChannel.ts";

export default class QueueServer extends WebSocketChannel {
    private invites: Invite[];
    constructor( ){
        super();
        this.clients = new Map<string, UserInfoWebSocket>();
        this.invites = [];
        this.onOpenCallback = this.broadcastLobbyUser;
        this.onCloseCallback = this.onClientDisconnected;
    }

    public handleConnection(ctx: Context) : void {
        const username = ctx.request.url.searchParams.get('username') ? ctx.request.url.searchParams.get('username')! : 'AnonymousGuest';
        const newSocketId = super.handleConnection(ctx); 
        // socket.onopen = () => {
        //     this.broadcastLobbyUser();
        //     this.broadcast({
        //         event : eventType.userSuccessRegistration,
        //         id : socket.id,
        //     }, socket.id);
        // };
        // socket.onclose = () => this.onClientDisconnected(socket.id);
        // socket.onmessage = (m) => this.onUserMessage(socket.id, m);
    }

    private broadcastLobbyUser() : void {
        const users = [...this.clients.entries().map((ews) => ({
            id : ews[0],
            username : (ews[1] as UserInfoWebSocket).username
        }))];
        super.broadcastAll({
            event : eventType.userUpdate,
            usernames : users
        });
    }


    
    protected override onClientDisconnected(userId : string){
        super.onClientDisconnected(userId);
        this.broadcastLobbyUser();
    }

    private onUserMessage(userId : string, message: MessageEvent<string>){
        const parsedMessage = JSON.parse(message.data) as AppEvent;
        switch (parsedMessage.event) {
            case eventType.newMessage:
                this.userSendChat(userId, parsedMessage);
                break;
            case eventType.newInvite:
                this.userInvite(userId, parsedMessage);
                break;
            default:
            // case eventType.handleInvite:
            //     this.handleUserInvite(userId, parsedMessage);
            //     break;
        }
    }

    private handleUserInvite(currentUserid: string, message : AppEvent){
        const indexInvite = this.invites.findIndex((invite) => invite.from === message.from && invite.to === currentUserid);
        if(indexInvite === -1){
            return;
        }
        if (message.answser){
            this.roomCallback({id : message.from, username : this.lobbyClients.get(message.from)?.username!}, {id : currentUserid, username : this.lobbyClients.get(currentUserid)?.username!});
        } else {
            this.broadcast({
                event : eventType.inviteRefuses,
                from : currentUserid,
            }, currentUserid);
        }
        this.invites.splice(indexInvite, 1);
    }

    private userSendChat(userId : string, message : AppEvent){
        this.broadcastAll({
            event : eventType.newMessage,
            user : userId+'#'+this.lobbyClients.get(userId)?.username,
            message : message.message
        });
    }

    private userInvite(userId : string, message : AppEvent){
        if (userId === message.targetUser){
            // On ne s'invite pas soit même
            return;
        }
        this.broadcast({
            event : eventType.receiveInvite,
            from : userId
        }, message.targetUser);
        this.invites.push({
            from : userId,
            to : message.targetUser
        })
        this.log(`${userId} invited ${message.targetUser}`)
    }
}

type UserInfoWebSocket = EnhancedWebsocket & {
    username : string,
};

type AppEvent = {
    event: eventType,
    [key:string] : any
};

type Invite = {
    from : string,
    to : string
}

export type user = {
    id : string, 
    username : string
}

enum eventType {
    userSuccessRegistration = 'user-registration',
    userUpdate = 'user-update',
    newMessage = 'send-message',
    newInvite = 'send-invite',
    receiveInvite = 'receive-invite',
    handleInvite = 'handle-invite',
    inviteRefuses = 'invite-refused'
};