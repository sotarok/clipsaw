import { invoke as tauriInvoke } from "@tauri-apps/api/core";

export interface LogEntry {
  id: number;
  timestamp: number;
  command: string;
  args: Record<string, unknown> | undefined;
  response?: unknown;
  error?: string;
  duration?: number;
  status: "pending" | "ok" | "error";
}

type Listener = () => void;

let nextId = 1;
const logs: LogEntry[] = [];
const listeners = new Set<Listener>();
const MAX_LOGS = 200;

export function getLogs(): LogEntry[] {
  return logs;
}

export function clearLogs(): void {
  logs.length = 0;
  notify();
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

/** Drop-in replacement for `invoke` that logs request/response */
export async function debugInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  const entry: LogEntry = {
    id: nextId++,
    timestamp: Date.now(),
    command,
    args,
    status: "pending",
  };
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.pop();
  notify();

  const start = performance.now();
  try {
    const result = await tauriInvoke<T>(command, args);
    entry.response = result;
    entry.status = "ok";
    entry.duration = Math.round(performance.now() - start);
    notify();
    return result;
  } catch (err) {
    entry.error = String(err);
    entry.status = "error";
    entry.duration = Math.round(performance.now() - start);
    notify();
    throw err;
  }
}
