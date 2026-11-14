export {};

declare global {
  interface Window {
    mrkConnect: {
      getHostInfo(): Promise<{ port: number; pairingCode: string; status: "waiting" | "connected" }>;
      onHostStatus(callback: (status: "waiting" | "connected") => void): () => void;
    };
  }
}
