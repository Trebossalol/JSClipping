import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  MAX_CLIP_PRESETS,
  MAX_OBS_REPLAY_SECONDS,
  MIN_OBS_REPLAY_SECONDS,
} from "@shared/app.config";
import type { AppConfigDto, ClipPreset } from "@shared/ipc";
import { normalizeHotkey } from "@shared/hotkeys";
import { formatDuration } from "@/format";
import { SaveIcon } from "lucide-react";
import type { SettingsSection } from "../AppSidebar";
import { AboutSection } from "./AboutSection";
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

function replayDraftFrom(total: number | null | undefined): {
  minutes: string;
  seconds: string;
} {
  if (total == null || total <= 0) return { minutes: "", seconds: "" };
  return {
    minutes: String(Math.floor(total / 60)),
    seconds: String(total % 60),
  };
}

function parseReplayBufferSeconds(
  minutes: string,
  seconds: string,
): { ok: true; seconds: number | null } | { ok: false; error: string } {
  const minEmpty = minutes.trim() === "";
  const secEmpty = seconds.trim() === "";
  if (minEmpty && secEmpty) return { ok: true, seconds: null };
  const minRaw = minEmpty ? 0 : Number(minutes);
  const secRaw = secEmpty ? 0 : Number(seconds);
  if (
    !Number.isFinite(minRaw) ||
    !Number.isFinite(secRaw) ||
    !Number.isInteger(minRaw) ||
    !Number.isInteger(secRaw) ||
    minRaw < 0 ||
    secRaw < 0 ||
    secRaw > 59
  ) {
    return { ok: false, error: "Ungültige Pufferdauer." };
  }
  const total = minRaw * 60 + secRaw;
  if (total < MIN_OBS_REPLAY_SECONDS || total > MAX_OBS_REPLAY_SECONDS) {
    return {
      ok: false,
      error: `Die Pufferdauer muss zwischen ${formatDuration(MIN_OBS_REPLAY_SECONDS)} und ${formatDuration(MAX_OBS_REPLAY_SECONDS)} liegen.`,
    };
  }
  return { ok: true, seconds: total };
}

interface SettingsPanelProps {
  section: SettingsSection;
  config: AppConfigDto;
  replayMaxSeconds: number | null;
  onSave: (config: AppConfigDto) => Promise<AppConfigDto>;
  onGoToObsSettings: () => void;
}

export function SettingsPanel({
  section,
  config,
  replayMaxSeconds,
  onSave,
  onGoToObsSettings,
}: SettingsPanelProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [obsUrl, setObsUrl] = useState(config.OBS_URL);
  const [obsPassword, setObsPassword] = useState(config.OBS_PASSWORD);
  const [obsExePath, setObsExePath] = useState(config.OBS_EXE_PATH ?? "");
  const [obsScene, setObsScene] = useState(config.OBS_SCENE);
  const replaySeeded = useRef(config.OBS_REPLAY_SECONDS != null);
  const initialReplay = replayDraftFrom(
    config.OBS_REPLAY_SECONDS ?? replayMaxSeconds,
  );
  const [obsReplayMinutes, setObsReplayMinutes] = useState(initialReplay.minutes);
  const [obsReplaySeconds, setObsReplaySeconds] = useState(initialReplay.seconds);
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
  const [packaged, setPackaged] = useState<boolean | null>(null);
  const maxSeconds =
    replayMaxSeconds != null && replayMaxSeconds > 0 ? replayMaxSeconds : null;

  useEffect(() => {
    let cancelled = false;
    void window.api.isPackaged().then((value) => {
      if (!cancelled) setPackaged(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setObsUrl(config.OBS_URL);
    setObsPassword(config.OBS_PASSWORD);
    setObsExePath(config.OBS_EXE_PATH ?? "");
    setObsScene(config.OBS_SCENE);
    if (config.OBS_REPLAY_SECONDS != null) {
      const fromConfig = replayDraftFrom(config.OBS_REPLAY_SECONDS);
      setObsReplayMinutes(fromConfig.minutes);
      setObsReplaySeconds(fromConfig.seconds);
      replaySeeded.current = true;
    }
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
    config.OBS_EXE_PATH,
    config.OBS_SCENE,
    config.OBS_REPLAY_SECONDS,
    config.CLIP_OUTPUT_DIR,
    config.AUTOSTART,
    config.QUICK_ACTION_HOTKEY,
    config.CLIP_PRESETS,
  ]);

  useEffect(() => {
    if (replaySeeded.current) return;
    if (config.OBS_REPLAY_SECONDS != null) {
      replaySeeded.current = true;
      return;
    }
    if (replayMaxSeconds == null || replayMaxSeconds <= 0) return;
    replaySeeded.current = true;
    const live = replayDraftFrom(replayMaxSeconds);
    setObsReplayMinutes(live.minutes);
    setObsReplaySeconds(live.seconds);
  }, [config.OBS_REPLAY_SECONDS, replayMaxSeconds]);

  async function handleBrowse(): Promise<void> {
    const dir = await window.api.pickOutputDir();
    if (dir) setOutputDir(dir);
  }

  async function handleBrowseObsExe(): Promise<void> {
    const exe = await window.api.pickObsExe();
    if (exe) setObsExePath(exe);
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
      if (!next.OBS_URL) {
        toast.error("Bitte eine Server-Adresse eintragen.");
        return;
      }
      if (!next.OBS_PASSWORD) {
        toast.error("Bitte ein Passwort eintragen.");
        return;
      }
      next.OBS_EXE_PATH = (obsExePath ?? "").trim();
      next.OBS_SCENE = obsScene.trim();
      const replay = parseReplayBufferSeconds(obsReplayMinutes, obsReplaySeconds);
      if (!replay.ok) {
        toast.error(replay.error);
        return;
      }
      next.OBS_REPLAY_SECONDS = replay.seconds;
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
    } else if (section === "autostart") {
      if (packaged !== true) return;
      next.AUTOSTART = autostart;
    } else {
      return;
    }
    setSaving(true);
    try {
      const saved = await onSave(next);
      setObsUrl(saved.OBS_URL);
      setObsPassword(saved.OBS_PASSWORD);
      setObsExePath(saved.OBS_EXE_PATH ?? "");
      setObsScene(saved.OBS_SCENE);
      const savedReplay = replayDraftFrom(saved.OBS_REPLAY_SECONDS);
      setObsReplayMinutes(savedReplay.minutes);
      setObsReplaySeconds(savedReplay.seconds);
      if (saved.OBS_REPLAY_SECONDS != null) replaySeeded.current = true;
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

  if (section === "about") {
    return (
      <div className="mx-auto flex w-full max-w-200 flex-col gap-4 px-5 py-5">
        <AboutSection />
      </div>
    );
  }

  return (
    <form
      className="mx-auto flex min-h-full w-full max-w-200 flex-col px-5 pt-5"
      noValidate
      onSubmit={(e) => void handleSubmit(e)}
    >
      <div className="flex flex-1 flex-col gap-4 pb-4">
      {section === "obs" ? (
        <ObsSection
          url={obsUrl}
          password={obsPassword}
          exePath={obsExePath}
          scene={obsScene}
          replayMinutes={obsReplayMinutes}
          replaySeconds={obsReplaySeconds}
          replayInvalid={
            !parseReplayBufferSeconds(obsReplayMinutes, obsReplaySeconds).ok
          }
          liveReplaySeconds={maxSeconds}
          showPassword={showPassword}
          onUrlChange={setObsUrl}
          onPasswordChange={setObsPassword}
          onExePathChange={setObsExePath}
          onBrowseExe={() => void handleBrowseObsExe()}
          onSceneChange={setObsScene}
          onReplayMinutesChange={setObsReplayMinutes}
          onReplaySecondsChange={setObsReplaySeconds}
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
          onGoToObsSettings={onGoToObsSettings}
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
          available={packaged}
        />
      ) : null}
      </div>
      {section === "autostart" && packaged !== true ? null : (
        <div className="sticky bottom-0 z-10 -mx-5 mt-auto border-t border-white/10 bg-background/75 px-5 py-3 backdrop-blur-xl">
          <Button type="submit" disabled={saving}>
            <SaveIcon data-icon="inline-start" />
            Einstellungen speichern
          </Button>
        </div>
      )}
    </form>
  );
}
