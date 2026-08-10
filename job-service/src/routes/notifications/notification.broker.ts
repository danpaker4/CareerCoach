import type { FastifyReply } from "fastify";
import type { Notification } from "./notification.model";
import { serializeNotification } from "./notification.utils";

const HEARTBEAT_INTERVAL_MS = 25_000;

type ClientHandle = {
  reply: FastifyReply;
  heartbeat: NodeJS.Timeout;
};

export class NotificationBroker {
  private readonly clients = new Map<string, Set<ClientHandle>>();

  register = (userId: string, reply: FastifyReply): (() => void) => {
    const raw = reply.raw;
    raw.setHeader("Content-Type", "text/event-stream");
    raw.setHeader("Cache-Control", "no-cache");
    raw.setHeader("Connection", "keep-alive");
    raw.setHeader("X-Accel-Buffering", "no");
    raw.flushHeaders?.();
    raw.write(`event: connected\ndata: {"userId":"${userId}"}\n\n`);

    const heartbeat = setInterval(() => {
      try {
        raw.write(`event: heartbeat\ndata: {}\n\n`);
      } catch {
        // connection may be torn down between iterations; let the close handler clean up
      }
    }, HEARTBEAT_INTERVAL_MS);

    const handle: ClientHandle = { reply, heartbeat };
    const set = this.clients.get(userId) ?? new Set<ClientHandle>();
    set.add(handle);
    this.clients.set(userId, set);

    const cleanup = (): void => {
      clearInterval(heartbeat);
      const current = this.clients.get(userId);
      if (!current) return;
      current.delete(handle);
      if (current.size === 0) this.clients.delete(userId);
    };

    raw.on("close", cleanup);
    raw.on("error", cleanup);
    return cleanup;
  };

  broadcast = (userId: string, notification: Notification): void => {
    const set = this.clients.get(userId);
    if (!set || set.size === 0) return;
    const payload = JSON.stringify(serializeNotification(notification));
    for (const client of set) {
      try {
        client.reply.raw.write(`event: notification\ndata: ${payload}\n\n`);
      } catch {
        // broken pipe; cleanup will run via the 'close' event
      }
    }
  };

  shutdown = (): void => {
    for (const set of this.clients.values()) {
      for (const client of set) {
        clearInterval(client.heartbeat);
        try { client.reply.raw.end(); } catch { /* ignore */ }
      }
    }
    this.clients.clear();
  };
}
