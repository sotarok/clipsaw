"use client";

import { useState, useEffect, useRef } from "react";
import { getLogs, clearLogs, subscribe, type LogEntry } from "@/lib/debug-logger";
import { Bug, ChevronDown, ChevronUp, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>(getLogs);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribe(() => setLogs([...getLogs()]));
  }, []);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pendingCount = logs.filter((l) => l.status === "pending").length;
  const errorCount = logs.filter((l) => l.status === "error").length;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-3 right-3 z-50 flex items-center gap-1.5 rounded-full bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors shadow-lg"
      >
        <Bug className="h-3.5 w-3.5" />
        <span>Debug</span>
        {errorCount > 0 && (
          <span className="ml-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
            {errorCount}
          </span>
        )}
        {pendingCount > 0 && (
          <span className="ml-1 rounded-full bg-yellow-600 px-1.5 text-[10px] font-bold text-white">
            {pendingCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-zinc-900 border-t border-zinc-700 shadow-2xl max-h-[50vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Bug className="h-3.5 w-3.5" />
          <span className="font-medium text-zinc-300">IPC Debug</span>
          <span>{logs.length} calls</span>
          {errorCount > 0 && (
            <span className="text-red-400">{errorCount} errors</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
            onClick={() => { clearLogs(); setExpandedIds(new Set()); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-zinc-500 hover:text-zinc-300"
            onClick={() => setOpen(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Log entries */}
      <div ref={scrollRef} className="flex-1 overflow-auto text-xs font-mono">
        {logs.length === 0 ? (
          <div className="px-3 py-6 text-center text-zinc-600">No IPC calls yet</div>
        ) : (
          logs.map((entry) => (
            <LogRow
              key={entry.id}
              entry={entry}
              expanded={expandedIds.has(entry.id)}
              onToggle={() => toggleExpand(entry.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function LogRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: LogEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusColor =
    entry.status === "error"
      ? "text-red-400"
      : entry.status === "pending"
        ? "text-yellow-400"
        : "text-green-400";

  const statusDot =
    entry.status === "error" ? "bg-red-500" : entry.status === "pending" ? "bg-yellow-500" : "bg-green-600";

  const time = new Date(entry.timestamp);
  const timeStr = `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}:${time.getSeconds().toString().padStart(2, "0")}.${time.getMilliseconds().toString().padStart(3, "0")}`;

  return (
    <div className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
      <div
        className="flex items-center gap-2 px-3 py-1 cursor-pointer select-none"
        onClick={onToggle}
      >
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
        <span className="text-zinc-600 w-[85px] shrink-0">{timeStr}</span>
        <span className="text-blue-400 font-medium truncate">{entry.command}</span>
        <span className="flex-1" />
        {entry.duration !== undefined && (
          <span className={`${statusColor} tabular-nums shrink-0`}>
            {entry.duration}ms
          </span>
        )}
        {expanded ? (
          <ChevronUp className="h-3 w-3 text-zinc-600 shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 text-zinc-600 shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="px-3 pb-2 space-y-1.5">
          {entry.args && Object.keys(entry.args).length > 0 && (
            <div>
              <span className="text-zinc-500">Request:</span>
              <pre className="mt-0.5 p-2 rounded bg-zinc-950 text-zinc-300 overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                {JSON.stringify(entry.args, null, 2)}
              </pre>
            </div>
          )}
          {entry.status === "ok" && entry.response !== undefined && (
            <div>
              <span className="text-zinc-500">Response:</span>
              <pre className="mt-0.5 p-2 rounded bg-zinc-950 text-green-300 overflow-x-auto max-h-60 whitespace-pre-wrap break-all">
                {JSON.stringify(entry.response, null, 2)}
              </pre>
            </div>
          )}
          {entry.status === "error" && entry.error && (
            <div>
              <span className="text-zinc-500">Error:</span>
              <pre className="mt-0.5 p-2 rounded bg-zinc-950 text-red-300 overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                {entry.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
