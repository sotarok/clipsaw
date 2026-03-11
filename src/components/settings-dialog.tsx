"use client";

import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppDirs {
  dataDir: string;
  inputDir: string | null;
  outputDir: string | null;
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function SettingsDialog({ open: isOpen, onClose, onSaved }: SettingsDialogProps) {
  const [dirs, setDirs] = useState<AppDirs | null>(null);
  const [inputDir, setInputDir] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [saving, setSaving] = useState(false);

  const loadDirs = useCallback(async () => {
    try {
      const data: AppDirs = await invoke("get_app_dirs");
      setDirs(data);
      setInputDir(data.inputDir ?? "");
      setOutputDir(data.outputDir ?? "");
    } catch (err) {
      console.error("Failed to load app dirs:", err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) loadDirs();
  }, [isOpen, loadDirs]);

  const pickDir = async (setter: (v: string) => void) => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) setter(selected as string);
  };

  const handleSave = async () => {
    if (!inputDir || !outputDir) return;
    setSaving(true);
    try {
      await invoke("set_input_dir", { path: inputDir });
      await invoke("set_output_dir", { path: outputDir });
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Failed to save dirs:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">ディレクトリ設定</h2>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">入力ディレクトリ</label>
            <p className="text-xs text-muted-foreground">メディアファイルの読み込み元</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputDir}
                onChange={(e) => setInputDir(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="/path/to/input"
              />
              <Button variant="outline" size="icon" onClick={() => pickDir(setInputDir)}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">出力ディレクトリ</label>
            <p className="text-xs text-muted-foreground">分割ファイルの書き出し先</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="/path/to/output"
              />
              <Button variant="outline" size="icon" onClick={() => pickDir(setOutputDir)}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {dirs && (
          <div className="text-xs text-muted-foreground">
            データ保存先: {dirs.dataDir}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>キャンセル</Button>
          <Button onClick={handleSave} disabled={!inputDir || !outputDir || saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Hook: 初回起動時にディレクトリが未設定かチェック */
export function useNeedsSetup() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    invoke<AppDirs>("get_app_dirs")
      .then((data) => {
        setNeedsSetup(!data.inputDir || !data.outputDir);
      })
      .catch(() => setNeedsSetup(true));
  }, []);

  return { needsSetup, setNeedsSetup };
}
