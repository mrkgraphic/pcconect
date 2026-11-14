export {};

declare global {
  interface Window {
    mrkConnect: {
      getHostInfo(): Promise<{ port: number; pairingCode: string; addresses: string[]; status: "waiting" | "connected"; qrDataUrl?: string }>;
      onHostStatus(callback: (status: "waiting" | "connected") => void): () => void;
    };
  }
}
