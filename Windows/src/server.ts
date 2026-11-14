import { createServer } from "node:http";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";

const PORT = 47831;
const MAX_MESSAGE_BYTES = 16 * 1024;
const pairingCode = String(randomInt(100000, 1000000));
const sessions = new Map<WebSocket, Buffer>();
const httpServer = createServer();
const wss = new WebSocketServer({ server: httpServer, maxPayload: MAX_MESSAGE_BYTES });

export type HostInfo = { port: number; pairingCode: string; status: "waiting" | "connected" };

let onStatus: (status: HostInfo["status"]) => void = () => undefined;
let connected = false;

function send(ws: WebSocket, value: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(value));
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(raw.toString()) as Record<string, unknown>;
    } catch {
      ws.close(1003, "Invalid JSON");
      return;
    }

    if (message.type === "pairRequest") {
      if (typeof message.pairingCode !== "string" || !safeEqual(message.pairingCode, pairingCode)) {
        send(ws, { type: "pairResult", accepted: false });
        ws.close(1008, "Pairing rejected");
        return;
      }
      const token = randomBytes(32);
      sessions.set(ws, token);
      connected = true;
      onStatus("connected");
      send(ws, { type: "pairResult", accepted: true, sessionToken: token.toString("hex") });
      return;
    }

    const token = sessions.get(ws);
    if (!token || typeof message.sessionToken !== "string" || !safeEqual(message.sessionToken, token.toString("hex"))) {
      ws.close(1008, "Authentication required");
      return;
    }

    // Input commands are deliberately not executed until the native input adapter is installed.
    if (message.type !== "ping") {
      send(ws, { type: "error", code: "FEATURE_NOT_READY", message: "Input adapter is not enabled yet." });
    } else {
      send(ws, { type: "pong" });
    }
  });

  ws.on("close", () => {
    sessions.delete(ws);
    if (sessions.size === 0 && connected) {
      connected = false;
      onStatus("waiting");
    }
  });
});

export function startLocalHost(statusCallback: (status: HostInfo["status"]) => void): Promise<HostInfo> {
  onStatus = statusCallback;
  return new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(PORT, "0.0.0.0", () => {
      httpServer.removeListener("error", reject);
      hostStarted = true;\n      resolve({ port: PORT, pairingCode, status: "waiting" });
    });
  });
}

export function stopLocalHost(): Promise<void> {
  sessions.clear();
  return new Promise((resolve) => {
    wss.close(() => httpServer.close(() => resolve()));
  });
}
