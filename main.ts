import { Application, Context, Router } from "@oak/oak";
import { oakCors } from "@tajpouria/cors";
import LobbyChannel from "./src/services/LobbyChannel.ts";
import GameChannel from "./src/services/GameChannel.ts";

const router = new Router();
const app = new Application();

const lobbyChannel = new LobbyChannel();
const gameChannels: Map<string, GameChannel> = new Map<string, GameChannel>();

router.get(
    "/chaussette_du_web",
    (ctx: Context) => lobbyChannel.handleConnection(ctx),
);
router.get("/game/:room_id", (context) => {
    gameChannels.entries().forEach((mapItem) => {
        const timeDiff =
            ((new Date()).getTime() - mapItem[1].createdAt.getTime()) /
            (1000 * 3600);
        if (timeDiff > 0.5) {
            gameChannels.delete(mapItem[0]);
        }
    });
    console.log("[new entry] /game/:room_id");
    const roomId = context?.params?.room_id;
    if (!roomId) {
        console.log("[error] No room id url path");
        context.response.body = "No room id provided.";
        return;
    }
    const inviteIndex = lobbyChannel.pendingInvites.findIndex((invite) =>
        invite.roomId === roomId
    );
    if (inviteIndex === -1) {
        console.log("[error] No invite found with id= " + roomId);
        context.response.body = "Room id not found";
        return;
    }

    if (!gameChannels.has(roomId)) {
        console.log("[creating room] - " + roomId);
        gameChannels.set(
            roomId,
            new GameChannel(
                [
                    lobbyChannel.pendingInvites[inviteIndex].u1,
                    lobbyChannel.pendingInvites[inviteIndex].u2,
                ],
                roomId,
                () => {
                    gameChannels.delete(roomId);
                    console.log("room " + roomId + " closed");
                    lobbyChannel.pendingInvites.slice(inviteIndex, 1);
                },
            ),
        );
    }

    gameChannels.get(roomId!)?.handleConnection(context);

    if (gameChannels.get(roomId)?.isRoomFull || !gameChannels.has(roomId)) {
        lobbyChannel.pendingInvites.slice(inviteIndex, 1);
        console.log("invite " + roomId + " closed");
    }
});

app.use(oakCors());
app.use(router.routes());
app.use(router.allowedMethods());
app.use(async (context: Context) => {
    await context.send({
        root: Deno.cwd(),
        index: "public/index.html",
    });
});

await app.listen({ port: 8000 });
