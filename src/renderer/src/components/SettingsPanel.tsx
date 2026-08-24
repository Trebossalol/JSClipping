import { useEffect, useRef, useState, type FormEvent } from "react";
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
  PlugIcon,
  PlusIcon,
  PowerIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_CLIP_PRESETS,
  MAX_CLIP_PRESET_SECONDS,
  MAX_CLIP_PRESETS,
  MIN_CLIP_PRESET_SECONDS,
  normalizeClipPresets,
  type AppConfigDto,
} from "@shared/ipc";
import { Switch } from "@/components/ui/switch";
import { formatDuration } from "@/format";

interface PresetDraft {
  id: number;
  minutes: string;
  seconds: string;
}

const SUGGESTED_PRESET_SECONDS = [
  15, 30, 45, 60, 90, 120, 180, 300, 600, 900, 1200, 1800, 3600,
];

function parseDurationParts(minutes: string, seconds: string): number | null {
  const minRaw = minutes.trim() === "" ? 0 : Number(minutes);
  const secRaw = seconds.trim() === "" ? 0 : Number(seconds);
  if (!Number.isFinite(minRaw) || !Number.isFinite(secRaw)) return null;
  if (!Number.isInteger(minRaw) || !Number.isInteger(secRaw)) return null;
  if (minRaw < 0 || secRaw < 0) return null;
  const total = minRaw * 60 + secRaw;
  if (total < MIN_CLIP_PRESET_SECONDS || total > MAX_CLIP_PRESET_SECONDS) {
    return null;
  }
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

function nextPresetSeconds(existing: number[]): number {
  for (const candidate of SUGGESTED_PRESET_SECONDS) {
    if (!existing.includes(candidate)) return candidate;
  }
  for (let s = MIN_CLIP_PRESET_SECONDS; s <= MAX_CLIP_PRESET_SECONDS; s++) {
    if (!existing.includes(s)) return s;
  }
  return MIN_CLIP_PRESET_SECONDS;
}

function duplicatePresetSeconds(drafts: PresetDraft[]): Set<number> {
  const counts = new Map<number, number>();
  for (const draft of drafts) {
    const total = parseDurationParts(draft.minutes, draft.seconds);
    if (total == null) continue;
    counts.set(total, (counts.get(total) ?? 0) + 1);
  }
  const dups = new Set<number>();
  for (const [seconds, count] of counts) {
    if (count > 1) dups.add(seconds);
  }
  return dups;
}

function collectClipPresets(
  drafts: PresetDraft[],
): { ok: true; values: number[] } | { ok: false; error: string } {
  if (drafts.length === 0) {
    return { ok: false, error: "Mindestens ein Clip-Preset." };
  }
  const parsed: number[] = [];
  for (const draft of drafts) {
    const total = parseDurationParts(draft.minutes, draft.seconds);
    if (total == null) {
      return {
        ok: false,
        error: `Jedes Preset braucht eine Dauer zwischen ${formatDuration(MIN_CLIP_PRESET_SECONDS)} und ${formatDuration(MAX_CLIP_PRESET_SECONDS)}.`,
      };
    }
    parsed.push(total);
  }
  return { ok: true, values: normalizeClipPresets(parsed) };
}

interface SettingsPanelProps {
  config: AppConfigDto;
  onSave: (config: AppConfigDto) => Promise<AppConfigDto>;
}

export function SettingsPanel({ config, onSave }: SettingsPanelProps) {
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
      .map((row) => parseDurationParts(row.minutes, row.seconds))
      .filter((n): n is number => n != null);
    const total = nextPresetSeconds(existing);
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
    const collected = collectClipPresets(clipPresets);
    if (!collected.ok) {
      toast.error(collected.error);
      return;
    }
    setSaving(true);
    try {
      const saved = await onSave({
        OBS_URL: obsUrl.trim(),
        OBS_PASSWORD: obsPassword,
        CLIP_OUTPUT_DIR: outputDir.trim(),
        AUTOSTART: autostart,
        CLIP_PRESETS: collected.values,
      });
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

  const duplicateTotals = duplicatePresetSeconds(clipPresets);
  const hasInvalidPreset = clipPresets.some(
    (row) => parseDurationParts(row.minutes, row.seconds) == null,
  );

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <PlugIcon className="size-3.5" />
          Verbindung
        </p>
        <p className="text-xs text-muted-foreground">
          Gemeinsam mit Action Ring über %APPDATA%\JSClipping\config.json
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <Card className="min-w-[min(100%,18rem)] flex-1 basis-[calc(50%-0.5rem)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <CableIcon className="size-4" />
              obs-websocket
            </CardTitle>
            <CardDescription>OBS WebSocket</CardDescription>
          </CardHeader>
          <CardContent>
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
                      aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                    >
                      {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className="min-w-[min(100%,18rem)] flex-1 basis-[calc(50%-0.5rem)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <FolderOutputIcon className="size-4" />
              Ausgabe
            </CardTitle>
            <CardDescription>Unterordner JJJJ\MM</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="clip-output-dir">Clip-Ausgabeordner</FieldLabel>
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

        <Card className="min-w-[min(100%,28rem)] flex-[2] basis-[min(100%,28rem)]">
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
                </FieldDescription>
                <div className="flex flex-col gap-3">
                  {clipPresets.map((draft, index) => {
                    const total = parseDurationParts(draft.minutes, draft.seconds);
                    const invalid = total == null;
                    const duplicate = total != null && duplicateTotals.has(total);
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
                          max={Math.floor(MAX_CLIP_PRESET_SECONDS / 60)}
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
                <FieldError>
                  Jedes Preset braucht eine Dauer zwischen{" "}
                  {formatDuration(MIN_CLIP_PRESET_SECONDS)} und{" "}
                  {formatDuration(MAX_CLIP_PRESET_SECONDS)}.
                </FieldError>
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
                  onClick={() => applyPresetSeconds([...DEFAULT_CLIP_PRESETS])}
                >
                  <RotateCcwIcon data-icon="inline-start" />
                  Standard (30s / 1m / 5m / 10m)
                </Button>
              </div>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

        <Card className="min-w-[min(100%,16rem)] flex-1 self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <PowerIcon className="size-4" />
              Autostart
            </CardTitle>
            <CardDescription>Beim Windows-Anmelden</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="autostart">
                    JSClipping und OBS im Clip-Modus
                  </FieldLabel>
                  <FieldDescription>
                    Startet JSClipping und OBS mit Wiederholungspuffer, minimiert
                    in den Infobereich.
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
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          <SaveIcon data-icon="inline-start" />
          Einstellungen speichern
        </Button>
      </div>
    </form>
  );
}
