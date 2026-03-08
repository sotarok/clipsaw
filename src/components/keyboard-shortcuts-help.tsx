"use client";

import { useState, useEffect } from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const shortcuts = [
  { keys: ["Space"], description: "再生 / 停止" },
  { keys: ["←"], description: "5秒戻る" },
  { keys: ["→"], description: "5秒進む" },
  { keys: ["?"], description: "ショートカット一覧を表示" },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target.isContentEditable) return;

      if (e.key === "?") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-4 right-4 z-40 h-8 w-8 rounded-full opacity-60 hover:opacity-100"
        onClick={() => setOpen(true)}
      >
        <CircleHelp className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
            <DialogDescription>
              波形バー・シークバーにフォーカス時に使用可能
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {shortcuts.map((s) => (
              <div key={s.description} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{s.description}</span>
                <div className="flex gap-1">
                  {s.keys.map((key) => (
                    <kbd
                      key={key}
                      className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded border border-border bg-muted text-xs font-mono"
                    >
                      {key}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
