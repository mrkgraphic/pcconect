import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import readline from "node:readline";

type InputCommand =
  | { type: "mouseMove"; x: number; y: number }
  | { type: "mouseButton"; button: "left" | "right" | "middle"; down: boolean }
  | { type: "mouseScroll"; delta: number }
  | { type: "key"; key: string; down: boolean }
  | { type: "text"; text: string };

export class NativeInput {
  private child: ChildProcessWithoutNullStreams | null = null;
  private ready = false;

  start(): void {
    if (this.child) return;
    const executable = process.env.MRK_INPUT_EXE ??
      (process.resourcesPath
        ? path.join(process.resourcesPath, "native", "MrkInput.exe")
        : path.resolve(__dirname, "../native/MrkInput/bin/Release/net8.0-windows/MrkInput.exe"));
    const child = spawn(executable, [], { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    this.child = child;
    const lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      try { const message = JSON.parse(line) as { ready?: boolean; ok?: boolean; error?: string }; if (message.ready === true) this.ready = true; else if (message.ok === false) console.warn("MRK native input rejected command:", message.error ?? "Unknown error"); } catch { this.ready = false; }
    });
    child.on("error", () => { this.ready = false; this.child = null; });
    child.on("exit", () => { this.ready = false; this.child = null; });
  }

  send(command: InputCommand): boolean {
    if (!this.child || this.child.killed || !this.child.stdin.writable || !this.ready) return false;
    this.child.stdin.write(JSON.stringify(command) + "\n");
    return true;
  }

  stop(): void {
    this.child?.stdin.end();
    this.child = null;
    this.ready = false;
  }
}
