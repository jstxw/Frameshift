"use client";

import { useState } from "react";
import {
  Palette,
  Maximize2,
  Replace,
  Trash2,
  EyeOff,
  ImageOff,
  ImagePlus,
  Sparkles,
  ArrowUpCircle,
  WandSparkles,
  Droplets,
  Plus,
  X,
} from "lucide-react";

export type EditAction =
  | "recolor"
  | "resize"
  | "replace"
  | "delete"
  | "blur_region"
  | "bg_remove"
  | "bg_replace"
  | "enhance"
  | "upscale"
  | "restore"
  | "gen_recolor";

interface EditOption {
  id: EditAction;
  icon: React.ElementType;
  label: string;
  needsColor?: boolean;
  needsPrompt?: boolean;
  needsScale?: boolean;
  category: "object" | "frame";
}

const EDIT_OPTIONS: EditOption[] = [
  { id: "delete", icon: Trash2, label: "Remove", category: "object" },
  { id: "recolor", icon: Palette, label: "Recolor", needsColor: true, category: "object" },
  { id: "replace", icon: Replace, label: "Replace", needsPrompt: true, category: "object" },
  { id: "resize", icon: Maximize2, label: "Resize", needsScale: true, category: "object" },
  { id: "blur_region", icon: EyeOff, label: "Blur", category: "object" },
  { id: "gen_recolor", icon: Droplets, label: "AI Recolor", needsPrompt: true, needsColor: true, category: "object" },
  { id: "bg_remove", icon: ImageOff, label: "Remove BG", category: "frame" },
  { id: "bg_replace", icon: ImagePlus, label: "Replace BG", needsPrompt: true, category: "frame" },
  { id: "enhance", icon: Sparkles, label: "Enhance", category: "frame" },
  { id: "upscale", icon: ArrowUpCircle, label: "Upscale", category: "frame" },
  { id: "restore", icon: WandSparkles, label: "Restore", category: "frame" },
];

const COLOR_PRESETS = [
  "#F43F5E", "#EF4444", "#F59E0B", "#10B981",
  "#0EA5E9", "#8B5CF6", "#EC4899", "#FFFFFF",
  "#171717", "#6366F1", "#14B8A6", "#F97316",
];

interface EditToolbarProps {
  objectLabel: string;
  onApply: (action: EditAction, params: { color?: string; prompt?: string; scale?: number }) => void;
  onClose: () => void;
}

export function EditToolbar({ objectLabel, onApply, onClose }: EditToolbarProps) {
  const [selected, setSelected] = useState<EditOption | null>(null);
  const [color, setColor] = useState("#F43F5E");
  const [prompt, setPrompt] = useState("");
  const [scale, setScale] = useState(1.5);

  const objectEdits = EDIT_OPTIONS.filter((o) => o.category === "object");
  const frameEdits = EDIT_OPTIONS.filter((o) => o.category === "frame");

  const handleApply = () => {
    if (!selected) return;
    onApply(selected.id, {
      color: selected.needsColor ? color.replace("#", "") : undefined,
      prompt: selected.needsPrompt ? prompt : undefined,
      scale: selected.needsScale ? scale : undefined,
    });
  };

  return (
    <div
      className="absolute right-4 top-4 z-30 w-[280px] bg-[#111827]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-slide-in-right"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
          <span className="text-white/90 text-sm font-medium">{objectLabel}</span>
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Option grid or param input */}
      {!selected ? (
        <div className="p-3">
          <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium mb-2 px-1">Object</p>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {objectEdits.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    if (!opt.needsColor && !opt.needsPrompt && !opt.needsScale) {
                      onApply(opt.id, {});
                    } else {
                      setSelected(opt);
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all group"
                >
                  <Icon className="w-4 h-4 group-hover:text-[var(--accent)] transition-colors" />
                  <span className="text-[10px] font-medium">{opt.label}</span>
                </button>
              );
            })}
          </div>

          <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium mb-2 px-1">Whole Frame</p>
          <div className="grid grid-cols-3 gap-1.5">
            {frameEdits.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    if (!opt.needsColor && !opt.needsPrompt && !opt.needsScale) {
                      onApply(opt.id, {});
                    } else {
                      setSelected(opt);
                    }
                  }}
                  className="flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all group"
                >
                  <Icon className="w-4 h-4 group-hover:text-[var(--accent)] transition-colors" />
                  <span className="text-[10px] font-medium">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Back button */}
          <button
            onClick={() => setSelected(null)}
            className="text-white/40 text-xs hover:text-white/70 transition-colors"
          >
            &larr; Back
          </button>

          <div className="flex items-center gap-2">
            {(() => { const Icon = selected.icon; return <Icon className="w-4 h-4 text-[var(--accent)]" />; })()}
            <span className="text-white text-sm font-medium">{selected.label}</span>
          </div>

          {/* Color picker */}
          {selected.needsColor && (
            <div>
              <p className="text-white/40 text-xs mb-2">Color</p>
              <div className="grid grid-cols-6 gap-1.5 mb-2">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      color === c ? "border-white scale-110" : "border-transparent hover:border-white/30"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#FF0000"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs outline-none focus:border-[var(--accent)]/50"
              />
            </div>
          )}

          {/* Prompt input */}
          {selected.needsPrompt && (
            <div>
              <p className="text-white/40 text-xs mb-2">
                {selected.id === "replace" ? "Replace with..." : selected.id === "bg_replace" ? "New background..." : "Describe..."}
              </p>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  selected.id === "replace" ? "e.g. a red sports car" :
                  selected.id === "bg_replace" ? "e.g. sunset beach" :
                  selected.id === "gen_recolor" ? "e.g. the car" :
                  "Describe what you want..."
                }
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-[var(--accent)]/50"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleApply()}
              />
            </div>
          )}

          {/* Scale slider */}
          {selected.needsScale && (
            <div>
              <div className="flex justify-between mb-2">
                <p className="text-white/40 text-xs">Scale</p>
                <p className="text-white/60 text-xs font-mono">{scale.toFixed(1)}x</p>
              </div>
              <input
                type="range"
                min="0.3"
                max="3.0"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </div>
          )}

          {/* Apply button */}
          <button
            onClick={handleApply}
            disabled={selected.needsPrompt && !prompt.trim()}
            className="w-full py-2.5 rounded-xl bg-[var(--accent)] text-white text-sm font-semibold hover:bg-[var(--accent-hover)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Apply {selected.label}
          </button>
        </div>
      )}
    </div>
  );
}
