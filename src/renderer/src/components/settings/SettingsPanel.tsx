import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MAX_CLIP_PRESETS } from "@shared/app.config";
import type { AppConfigDto, ClipPreset } from "@shared/ipc";
import { normalizeHotkey } from "@shared/hotkeys";
import { SaveIcon } from "lucide-react";
import type { SettingsSection } from "../AppSidebar";
import { AutostartSection } from "./AutostartSection";
import { ObsSection } from "./ObsSection";
import { PresetsSection } from "./PresetsSection";
import { StorageSection } from "./StorageSection";
import {
  collectClipPresets,
  draftsFromPresets,
  nextPresetSeconds,
  parseDurationParts,
  type PresetDraft,
} from "./presets";

interface SettingsPanelProps {
  section: SettingsSection;
  config: AppConfigDto;
  replayMaxSeconds: number | null;
  onSave: (config: AppConfigDto) => Promise<AppConfigDto>;
}

export function SettingsPanel({
  section,
  config,
  replayMaxSeconds,
  onSave,
}: SettingsPanelProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [obsUrl, setObsUrl] = useState(config.OBS_URL);
  const [obsPassword, setObsPassword] = useState(config.OBS_PASSWORD);
  const [obsScene, setObsScene] = useState(config.OBS_SCENE);
  const [outputDir, setOutputDir] = useState(config.CLIP_OUTPUT_DIR);
  const [autostart, setAutostart] = useState(config.AUTOSTART);
  const [quickActionHotkey, setQuickActionHotkey] = useState(
    config.QUICK_ACTION_HOTKEY,
  );
  const nextPresetId = useRef(1);
  const [clipPresets, setClipPresets] = useState<PresetDraft[]>(() => {
    const { drafts, nextId } = draftsFromPresets(
      config.CLIP_PRESETS,
      nextPresetId.current,
    );
    nextPresetId.current = nextId;
    return drafts;
  });
  const [saving, setSaving] = useState(false);
  const maxSeconds =
    replayMaxSeconds != null && replayMaxSeconds > 0 ? replayMaxSeconds : null;

  useEffect(() => {
    setObsUrl(config.OBS_URL);
    setObsPassword(config.OBS_PASSWORD);
    setObsScene(config.OBS_SCENE);
    setOutputDir(config.CLIP_OUTPUT_DIR);
    setAutostart(config.AUTOSTART);
    setQuickActionHotkey(config.QUICK_ACTION_HOTKEY);
    const { drafts, nextId } = draftsFromPresets(
      config.CLIP_PRESETS,
      nextPresetId.current,
    );
    nextPresetId.current = nextId;
    setClipPresets(drafts);
  }, [
    config.OBS_URL,
    config.OBS_PASSWORD,
    config.OBS_SCENE,
    config.CLIP_OUTPUT_DIR,
    config.AUTOSTART,
    config.QUICK_ACTION_HOTKEY,
    config.CLIP_PRESETS,
  ]);

  async function handleBrowse(): Promise<void> {
    const dir = await window.api.pickOutputDir();
    if (dir) setOutputDir(dir);
  }

  function applyPresets(values: ClipPreset[]): void {
    const { drafts, nextId } = draftsFromPresets(
      values,
      nextPresetId.current,
    );
    nextPresetId.current = nextId;
    setClipPresets(drafts);
  }

  function updatePreset(
    id: number,
    field: "minutes" | "seconds",
    value: string,
  ): void {
    setClipPresets((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function updatePresetHotkey(id: number, hotkey: string | null): void {
    setClipPresets((rows) =>
      rows.map((row) => (row.id === id ? { ...row, hotkey } : row)),
    );
  }

  function movePreset(index: number, direction: -1 | 1): void {
    const next = index + direction;
    if (next < 0 || next >= clipPresets.length) return;
    setClipPresets((rows) => {
      const copy = [...rows];
      const [item] = copy.splice(index, 1);
      if (!item) return rows;
      copy.splice(next, 0, item);
      return copy;
    });
  }

  function addPreset(): void {
    if (clipPresets.length >= MAX_CLIP_PRESETS) return;
    const existing = clipPresets
      .map((row) => parseDurationParts(row.minutes, row.seconds, maxSeconds))
      .filter((n): n is number => n != null);
    const total = nextPresetSeconds(existing, maxSeconds);
    const id = nextPresetId.current++;
    setClipPresets((rows) => [
      ...rows,
      {
        id,
        minutes: String(Math.floor(total / 60)),
        seconds: String(total % 60),
        hotkey: null,
      },
    ]);
  }

  function removePreset(id: number): void {
    setClipPresets((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== id)));
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    const next: AppConfigDto = { ...config };
    if (section === "obs") {
      next.OBS_URL = obsUrl.trim();
      next.OBS_PASSWORD = obsPassword;
      next.OBS_SCENE = obsScene.trim();
    } else if (section === "storage") {
      next.CLIP_OUTPUT_DIR = outputDir.trim();
    } else if (section === "presets") {
      const collected = collectClipPresets(clipPresets, maxSeconds);
      if (!collected.ok) {
        toast.error(collected.error);
        return;
      }
      next.CLIP_PRESETS = collected.values;
      const menuHotkey = quickActionHotkey
        ? normalizeHotkey(quickActionHotkey)
        : null;
      if (quickActionHotkey && !menuHotkey) {
        toast.error(
          "Ungültiges Tastenkürzel für das Schnellmenü. Mindestens Strg, Alt oder Windows plus eine Taste.",
        );
        return;
      }
      if (
        menuHotkey &&
        collected.values.some((preset) => preset.hotkey === menuHotkey)
      ) {
        toast.error(
          "Das Schnellmenü-Tastenkürzel ist schon einem Preset zugeordnet.",
        );
        return;
      }
      next.QUICK_ACTION_HOTKEY = menuHotkey;
    } else {
      next.AUTOSTART = autostart;
    }
    setSaving(true);
    try {
      const saved = await onSave(next);
      setObsUrl(saved.OBS_URL);
      setObsPassword(saved.OBS_PASSWORD);
      setObsScene(saved.OBS_SCENE);
      setOutputDir(saved.CLIP_OUTPUT_DIR);
      setAutostart(saved.AUTOSTART);
      setQuickActionHotkey(saved.QUICK_ACTION_HOTKEY);
      applyPresets(saved.CLIP_PRESETS);
      toast.success("Einstellungen gespeichert.");
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      toast.error(text);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="mx-auto flex w-full max-w-200 flex-col gap-4"
      onSubmit={(e) => void handleSubmit(e)}
    >
      {section === "obs" ? (
        <ObsSection
          url={obsUrl}
          password={obsPassword}
          scene={obsScene}
          showPassword={showPassword}
          onUrlChange={setObsUrl}
          onPasswordChange={setObsPassword}
          onSceneChange={setObsScene}
          onTogglePassword={() => setShowPassword((s) => !s)}
        />
      ) : null}

      {section === "storage" ? (
        <StorageSection
          outputDir={outputDir}
          onOutputDirChange={setOutputDir}
          onBrowse={() => void handleBrowse()}
        />
      ) : null}

      {section === "presets" ? (
        <PresetsSection
          clipPresets={clipPresets}
          maxSeconds={maxSeconds}
          quickActionHotkey={quickActionHotkey}
          onQuickActionHotkeyChange={setQuickActionHotkey}
          onUpdate={updatePreset}
          onUpdateHotkey={updatePresetHotkey}
          onMove={movePreset}
          onAdd={addPreset}
          onRemove={removePreset}
          onReset={applyPresets}
        />
      ) : null}

      {section === "autostart" ? (
        <AutostartSection
          autostart={autostart}
          onAutostartChange={setAutostart}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          <SaveIcon data-icon="inline-start" />
          Einstellungen speichern
        </Button>
      </div>
    </form>
  );
}
