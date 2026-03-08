"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OutputSettingsProps {
  outputFormat: "copy" | "mp3";
  mp3Bitrate: string;
  mediaType: "video" | "audio" | null;
  onFormatChange: (format: "copy" | "mp3") => void;
  onBitrateChange: (bitrate: string) => void;
}

export function OutputSettings({
  outputFormat,
  mp3Bitrate,
  mediaType,
  onFormatChange,
  onBitrateChange,
}: OutputSettingsProps) {
  const showMp3Option = mediaType === "audio";

  return (
    <div className="flex items-center gap-4">
      <Label className="text-sm shrink-0">出力:</Label>

      <RadioGroup
        value={outputFormat}
        onValueChange={(v) => onFormatChange(v as "copy" | "mp3")}
        className="flex items-center gap-3"
      >
        <div className="flex items-center gap-1.5">
          <RadioGroupItem value="copy" id="format-copy" />
          <Label htmlFor="format-copy" className="text-sm cursor-pointer">
            copy
          </Label>
        </div>
        {showMp3Option && (
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="mp3" id="format-mp3" />
            <Label htmlFor="format-mp3" className="text-sm cursor-pointer">
              mp3
            </Label>
          </div>
        )}
      </RadioGroup>

      {outputFormat === "mp3" && showMp3Option && (
        <Select value={mp3Bitrate} onValueChange={onBitrateChange}>
          <SelectTrigger className="w-24 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="128k">128k</SelectItem>
            <SelectItem value="192k">192k</SelectItem>
            <SelectItem value="256k">256k</SelectItem>
            <SelectItem value="320k">320k</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
