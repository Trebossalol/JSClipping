import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import {
  CableIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  EyeIcon,
  EyeOffIcon,
  FolderIcon,
  FolderOutputIcon,
  InfoIcon,
  PlusIcon,
  PowerIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import {
  APP_NAME,
  DEFAULT_CLIP_PRESETS,
  MAX_CLIP_PRESETS,
  MIN_CLIP_PRESET_SECONDS,
} from "@shared/app.config";
import { normalizeClipPresets, type AppConfigDto } from "@shared/ipc";
import { Switch } from "@/components/ui/switch";
import { formatDuration } from "@/format";
import { StoragePanel } from "./StoragePanel";
import type { SettingsSection } from "./AppSidebar";

interface PresetDraft {
  id: number;
  minutes: string;
  seconds: string;
}

const SUGGESTED_PRESET_SECONDS = [
  15, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1200, 1800, 3600,
];

function parseDurationParts(
  minutes: string,
  seconds: string,
  maxSeconds: number | null,
): number | null {
  const minRaw = minutes.trim() === "" ? 0 : Number(minutes);
  const secRaw = seconds.trim() === "" ? 0 : Number(seconds);
  if (!Number.isFinite(minRaw) || !Number.isFinite(secRaw)) return null;
  if (!Number.isInteger(minRaw) || !Number.isInteger(secRaw)) return null;
  if (minRaw < 0 || secRaw < 0) return null;
  const total = minRaw * 60 + secRaw;
  if (total < MIN_CLIP_PRESET_SECONDS) return null;
  if (maxSeconds != null && total > maxSeconds) return null;
  return total;
}

function draftsFromSeconds(
  values: number[],
  startId: number,
): { drafts: PresetDraft[]; nextId: number } {
  let id = startId;
  const drafts = values.map((total) => ({
    id: id++,
    minutes: String(Math.floor(total / 60)),
    seconds: String(total % 60),
  }));
  return { drafts, nextId: id };
}

function defaultPresetsForMax(maxSeconds: number | null): number[] {
  const defaults = [...DEFAULT_CLIP_PRESETS];
  if (maxSeconds == null) return defaults;
  const fitted = defaults.filter((s) => s <= maxSeconds);
  return fitted.length > 0 ? fitted : [maxSeconds];
}

function nextPresetSeconds(
  existing: number[],
  maxSeconds: number | null,
): number {
  for (const candidate of SUGGESTED_PRESET_SECONDS) {
    if (maxSeconds != null && candidate > maxSeconds) continue;
    if (!existing.includes(candidate)) return candidate;
  }
  if (maxSeconds == null) {
    let s = MIN_CLIP_PRESET_SECONDS;
    while (existing.includes(s)) s += 1;
    return s;
  }
  for (let s = MIN_CLIP_PRESET_SECONDS; s <= maxSeconds; s++) {
    if (!existing.includes(s)) return s;
  }
  return maxSeconds;
}

function duplicatePresetSeconds(
  drafts: PresetDraft[],
  maxSeconds: number | null,
): Set<number> {
  const counts = new Map<number, number>();
  for (const draft of drafts) {
    const total = parseDurationParts(draft.minutes, draft.seconds, maxSeconds);
    if (total == null) continue;
    counts.set(total, (counts.get(total) ?? 0) + 1);
  }
  const dups = new Set<number>();
  for (const [seconds, count] of counts) {
    if (count > 1) dups.add(seconds);
  }
  return dups;
}

function presetRangeError(maxSeconds: number | null): string {
  if (maxSeconds == null) {
    return `Jedes Preset braucht eine Dauer von mindestens ${formatDuration(MIN_CLIP_PRESET_SECONDS)}.`;
  }
  return `Jedes Preset braucht eine Dauer zwischen ${formatDuration(MIN_CLIP_PRESET_SECONDS)} und ${formatDuration(maxSeconds)} (OBS-Puffer).`;
}

function collectClipPresets(
  drafts: PresetDraft[],
  maxSeconds: number | null,
): { ok: true; values: number[] } | { ok: false; error: string } {
  if (drafts.length === 0) {
    return { ok: false, error: "Mindestens ein Clip-Preset." };
  }
  const parsed: number[] = [];
  for (const draft of drafts) {
    const total = parseDurationParts(draft.minutes, draft.seconds, maxSeconds);
    if (total == null) {
      return { ok: false, error: presetRangeError(maxSeconds) };
    }
    parsed.push(total);
  }
  return { ok: true, values: normalizeClipPresets(parsed) };
}

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
  const [outputDir, setOutputDir] = useState(config.CLIP_OUTPUT_DIR);
  const [autostart, setAutostart] = useState(config.AUTOSTART);
  const nextPresetId = useRef(1);
  const [clipPresets, setClipPresets] = useState<PresetDraft[]>(() => {
    const { drafts, nextId } = draftsFromSeconds(
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
    setOutputDir(config.CLIP_OUTPUT_DIR);
    setAutostart(config.AUTOSTART);
    const { drafts, nextId } = draftsFromSeconds(
      config.CLIP_PRESETS,
      nextPresetId.current,
    );
    nextPresetId.current = nextId;
    setClipPresets(drafts);
  }, [
    config.OBS_URL,
    config.OBS_PASSWORD,
    config.CLIP_OUTPUT_DIR,
    config.AUTOSTART,
    config.CLIP_PRESETS,
  ]);

  async function handleBrowse(): Promise<void> {
    const dir = await window.api.pickOutputDir();
    if (dir) setOutputDir(dir);
  }

  function applyPresetSeconds(values: number[]): void {
    const { drafts, nextId } = draftsFromSeconds(
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
      },
    ]);
  }

  function removePreset(id: number): void {
    setClipPresets((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== id)));
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    const next: AppConfigDto = {
      OBS_URL: config.OBS_URL,
      OBS_PASSWORD: config.OBS_PASSWORD,
      CLIP_OUTPUT_DIR: config.CLIP_OUTPUT_DIR,
      AUTOSTART: config.AUTOSTART,
      CLIP_PRESETS: config.CLIP_PRESETS,
    };
    if (section === "obs") {
      next.OBS_URL = obsUrl.trim();
      next.OBS_PASSWORD = obsPassword;
    } else if (section === "storage") {
      next.CLIP_OUTPUT_DIR = outputDir.trim();
    } else if (section === "presets") {
      const collected = collectClipPresets(clipPresets, maxSeconds);
      if (!collected.ok) {
        toast.error(collected.error);
        return;
      }
      next.CLIP_PRESETS = collected.values;
    } else {
      next.AUTOSTART = autostart;
    }
    setSaving(true);
    try {
      const saved = await onSave(next);
      setObsUrl(saved.OBS_URL);
      setObsPassword(saved.OBS_PASSWORD);
      setOutputDir(saved.CLIP_OUTPUT_DIR);
      setAutostart(saved.AUTOSTART);
      applyPresetSeconds(saved.CLIP_PRESETS);
      toast.success("Einstellungen gespeichert.");
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      toast.error(text);
    } finally {
      setSaving(false);
    }
  }

  const duplicateTotals = duplicatePresetSeconds(clipPresets, maxSeconds);
  const hasInvalidPreset = clipPresets.some(
    (row) => parseDurationParts(row.minutes, row.seconds, maxSeconds) == null,
  );

  return (
    <form
      className="mx-auto flex w-full max-w-200 flex-col gap-4"
      onSubmit={(e) => void handleSubmit(e)}
    >
      {section === "obs" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <CableIcon className="size-4" />
              OBS Verbindung
            </CardTitle>
            <CardDescription>Verbindung zu OBS ReplayBuffer</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Alert variant="info">
              <InfoIcon />
              <AlertTitle>WebSocket aktivieren</AlertTitle>
              <AlertDescription>
                In OBS muss der WebSocket-Server eingeschaltet sein (Extras →
                WebSocket-Server-Einstellungen).
              </AlertDescription>
            </Alert>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="obs-url">URL</FieldLabel>
                <Input
                  id="obs-url"
                  type="url"
                  required
                  autoComplete="off"
                  value={obsUrl}
                  onChange={(e) => setObsUrl(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="obs-password">Passwort</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="obs-password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="off"
                    value={obsPassword}
                    onChange={(e) => setObsPassword(e.target.value)}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      type="button"
                      size="icon-xs"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={
                        showPassword ? "Passwort verbergen" : "Passwort anzeigen"
                      }
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      ) : null}

      {section === "storage" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <FolderOutputIcon className="size-4" />
                Ausgabe
              </CardTitle>
              <CardDescription>
                Speicherordner für Clips. Sollte der gleiche Pfad wie der OBS
                ReplayBuffer Ausgabeordner sein.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="clip-output-dir">
                    Clip-Ausgabeordner
                  </FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="clip-output-dir"
                      type="text"
                      required
                      autoComplete="off"
                      value={outputDir}
                      onChange={(e) => setOutputDir(e.target.value)}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        size="xs"
                        onClick={() => void handleBrowse()}
                      >
                        <FolderIcon data-icon="inline-start" />
                        Durchsuchen
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>
                    Neue Clips landen in Jahr/Monat-Ordnern. Umbenennen in der
                    Bibliothek benennt auch die Datei um.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
          <StoragePanel />
        </>
      ) : null}

      {section === "presets" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <ClockIcon className="size-4" />
              Clip-Presets
            </CardTitle>
            <CardDescription>Buttons in der Bibliothek</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel>Vorschaulängen</FieldLabel>
                <FieldDescription>
                  Gilt nur für die Buttons in der App. Action Ring und CLI
                  übergeben die Dauer weiterhin als Sekunden.
                  {maxSeconds != null
                    ? ` Maximal ${formatDuration(maxSeconds)} laut OBS-Wiederholungspuffer.`
                    : " Die Obergrenze kommt von der maximalen Wiederholungszeit in OBS, sobald verbunden."}
                </FieldDescription>
                <div className="flex flex-col gap-3">
                  {clipPresets.map((draft, index) => {
                    const total = parseDurationParts(
                      draft.minutes,
                      draft.seconds,
                      maxSeconds,
                    );
                    const invalid = total == null;
                    const duplicate =
                      total != null && duplicateTotals.has(total);
                    return (
                      <div
                        key={draft.id}
                        className="flex flex-wrap items-center gap-2.5"
                      >
                        <Badge
                          variant={invalid ? "destructive" : "secondary"}
                          className="min-w-14 justify-center tabular-nums"
                        >
                          {total != null ? formatDuration(total) : "—"}
                        </Badge>
                        <InputGroup className="w-28">
                          <InputGroupInput
                            id={`clip-preset-min-${draft.id}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={
                              maxSeconds != null
                                ? Math.floor(maxSeconds / 60)
                                : undefined
                            }
                            step={1}
                            aria-label="Minuten"
                            aria-invalid={invalid || duplicate}
                            value={draft.minutes}
                            onChange={(e) =>
                              updatePreset(draft.id, "minutes", e.target.value)
                            }
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupText>Min</InputGroupText>
                          </InputGroupAddon>
                        </InputGroup>
                        <InputGroup className="w-28">
                          <InputGroupInput
                            id={`clip-preset-sec-${draft.id}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={59}
                            step={1}
                            aria-label="Sekunden"
                            aria-invalid={invalid || duplicate}
                            value={draft.seconds}
                            onChange={(e) =>
                              updatePreset(draft.id, "seconds", e.target.value)
                            }
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupText>Sek</InputGroupText>
                          </InputGroupAddon>
                        </InputGroup>
                        <ButtonGroup>
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="outline"
                            aria-label="Nach oben"
                            disabled={index === 0}
                            onClick={() => movePreset(index, -1)}
                          >
                            <ChevronUpIcon />
                          </Button>
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="outline"
                            aria-label="Nach unten"
                            disabled={index === clipPresets.length - 1}
                            onClick={() => movePreset(index, 1)}
                          >
                            <ChevronDownIcon />
                          </Button>
                          <Button
                            type="button"
                            size="icon-xs"
                            variant="outline"
                            aria-label="Entfernen"
                            disabled={clipPresets.length <= 1}
                            onClick={() => removePreset(draft.id)}
                          >
                            <Trash2Icon />
                          </Button>
                        </ButtonGroup>
                      </div>
                    );
                  })}
                </div>
                {duplicateTotals.size > 0 ? (
                  <FieldDescription>
                    Gleiche Dauern werden beim Speichern zusammengeführt.
                  </FieldDescription>
                ) : null}
                {hasInvalidPreset ? (
                  <FieldError>{presetRangeError(maxSeconds)}</FieldError>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={clipPresets.length >= MAX_CLIP_PRESETS}
                    title={
                      clipPresets.length >= MAX_CLIP_PRESETS
                        ? `Höchstens ${MAX_CLIP_PRESETS} Presets`
                        : undefined
                    }
                    onClick={addPreset}
                  >
                    <PlusIcon data-icon="inline-start" />
                    Preset hinzufügen
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      applyPresetSeconds(defaultPresetsForMax(maxSeconds))
                    }
                  >
                    <RotateCcwIcon data-icon="inline-start" />
                    Standard (30s / 1m / 5m / 10m)
                  </Button>
                </div>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
      ) : null}

      {section === "autostart" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <PowerIcon className="size-4" />
              Autostart
            </CardTitle>
            <CardDescription>
              Startet {APP_NAME} und OBS mit Wiederholungspuffer, minimiert
              in den Infobereich.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="autostart">
                    Automatischer Start
                  </FieldLabel>
                  <FieldDescription>
                    {APP_NAME} und OBS werden automatisch beim Windows Start ausgeführt.
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="autostart"
                  checked={autostart}
                  onCheckedChange={setAutostart}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
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
