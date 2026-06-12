import type { ChatRequestEvent } from "../queue/chat-queue.types";

const WEBSOCKET_OPEN_READY_STATE = 1;

type WebSocketConnection = {
    readonly readyState: number;
    readonly send: (payload: string) => void;
    readonly on: (event: "close" | "error", listener: () => void) => void;
};

export class ChatRequestRealtimeService {
    private readonly socketsByUserId = new Map<string, Set<WebSocketConnection>>();

    register = (userId: string, socket: WebSocketConnection): void => {
        const existingSockets = this.socketsByUserId.get(userId) ?? new Set<WebSocketConnection>();
        existingSockets.add(socket);
        this.socketsByUserId.set(userId, existingSockets);

        socket.on("close", () => {
            this.unregister(userId, socket);
        });
        socket.on("error", () => {
            this.unregister(userId, socket);
        });
    };

    broadcast = (event: ChatRequestEvent): void => {
        const sockets = this.socketsByUserId.get(event.userId);
        if (!sockets) {
            return;
        }

        const payload = JSON.stringify(event);
        sockets.forEach((socket) => {
            if (socket.readyState === WEBSOCKET_OPEN_READY_STATE) {
                socket.send(payload);
                return;
            }

            this.unregister(event.userId, socket);
        });
    };

    private unregister = (userId: string, socket: WebSocketConnection): void => {
        const sockets = this.socketsByUserId.get(userId);
        if (!sockets) {
            return;
        }

        sockets.delete(socket);
        if (sockets.size === 0) {
            this.socketsByUserId.delete(userId);
        }
    };
}
