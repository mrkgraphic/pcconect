import { createServer } from "node:http";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";

const PORT = 47831;
const MAX_MESSAGE_BYTES = 16 * 1024;
const pairingCode = String(randomInt(100000, 1000000));
const sessions = new Map<WebSocket, Buffer>();
const attemptsByIp = new Map<string, { count: number; resetAt: number }>();
const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify({ name: "MRK Connect", version: 1, port: PORT }));
});
const wss = new WebSocketServer({ server: httpServer, maxPayload: MAX_MESSAGE_BYTES });

export type HostInfo = { port: number; pairingCode: string; status: "waiting" | "connected" };
let onStatus: (status: HostInfo["status"]) => void = () => undefined;
let hostStarted = false;

function send(ws: WebSocket, value: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(value));
}
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function allowPair(ip: string): boolean {
  const now = Date.now();
  const entry = attemptsByIp.get(ip);
  if (!entry || now >= entry.resetAt) {
    attemptsByIp.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count += 1;
  return true;
}

wss.on("connection", (ws, request) => {
  const ip = request.socket.remoteAddress ?? "unknown";
  let authenticated = false;
  ws.on("message", (raw) => {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(raw.toString()) as Record<string, unknown>;
    } catch {
      ws.close(1003, "Invalid JSON");
      return;
    }
    if (message.type === "pairRequest") {
      if (authenticated || !allowPair(ip)) {
        send(ws, { type: "pairResult", accepted: false, reason: "RATE_LIMITED" });
        ws.close(1008, "Pairing rate limit");
        return;
      }
      if (typeof message.pairingCode !== "string" || !safeEqual(message.pairingCode, pairingCode)) {
        send(ws, { type: "pairResult", accepted: false });
        ws.close(1008, "Pairing rejected");
        return;
      }
      const token = randomBytes(32);
      sessions.set(ws, token);
      authenticated = true;
      onStatus("connected");
      send(ws, { type: "pairResult", accepted: true, sessionToken: token.toString("hex") });
      return;
    }
    const token = sessions.get(ws);
    if (!token || typeof message.sessionToken !== "string" || !safeEqual(message.sessionToken, token.toString("hex"))) {
      ws.close(1008, "Authentication required");
      return;
    }
    if (message.type === "ping") send(ws, { type: "pong" });
    else send(ws, { type: "error", code: "FEATURE_NOT_READY", message: "This command is not enabled yet." });
  });
  ws.on("close", () => {
    sessions.delete(ws);
    if (sessions.size === 0) onStatus("waiting");
  });
});

export function startLocalHost(statusCallback: (status: HostInfo["status"]) => void): Promise<HostInfo> {
  onStatus = statusCallback;
  return new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(PORT, "0.0.0.0", () => {
      httpServer.removeListener("error", reject);
      hostStarted = true;
      resolve({ port: PORT, pairingCode, status: "waiting" });
    });
  });
}
export function stopLocalHost(): Promise<void> {
  if (!hostStarted) return Promise.resolve();
  hostStarted = false;
  sessions.clear();
  for (const client of wss.clients) client.close(1001, "Host shutting down");
  return new Promise((resolve) => {
    wss.close(() => httpServer.close(() => resolve()));
  });
}
