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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { MAX_CLIP_PRESETS } from "@shared/app.config";
import type { ClipPreset } from "@shared/ipc";
import { normalizeHotkey } from "@shared/hotkeys";
import { formatDuration } from "@/format";
import { HotkeyInput } from "../HotkeyInput";
import {
  defaultPresetsForMax,
  duplicatePresetHotkeys,
  duplicatePresetSeconds,
  parseDurationParts,
  presetRangeError,
  type PresetDraft,
} from "./presets";

interface PresetsSectionProps {
  clipPresets: PresetDraft[];
  maxSeconds: number | null;
  quickActionHotkey: string | null;
  onQuickActionHotkeyChange: (hotkey: string | null) => void;
  onUpdate: (id: number, field: "minutes" | "seconds", value: string) => void;
  onUpdateHotkey: (id: number, hotkey: string | null) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onAdd: () => void;
  onRemove: (id: number) => void;
  onReset: (values: ClipPreset[]) => void;
}

export function PresetsSection({
  clipPresets,
  maxSeconds,
  quickActionHotkey,
  onQuickActionHotkeyChange,
  onUpdate,
  onUpdateHotkey,
  onMove,
  onAdd,
  onRemove,
  onReset,
}: PresetsSectionProps) {
  const duplicateTotals = duplicatePresetSeconds(clipPresets, maxSeconds);
  const duplicateHotkeys = duplicatePresetHotkeys(
    clipPresets,
    quickActionHotkey,
  );
  const menuHotkey = quickActionHotkey
    ? normalizeHotkey(quickActionHotkey)
    : null;
  const menuHotkeyTaken =
    menuHotkey != null && duplicateHotkeys.has(menuHotkey);
  const hasInvalidPreset = clipPresets.some(
    (row) => parseDurationParts(row.minutes, row.seconds, maxSeconds) == null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <ClockIcon className="size-4" />
          Clip-Presets
        </CardTitle>
        <CardDescription>
          Längen für die Buttons und ein Tastenkürzel für das Schnellmenü
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="quick-action-hotkey">Schnellmenü</FieldLabel>
            <FieldDescription>
              Ein Tastenkürzel öffnet ein kleines Menü im Vordergrund. Dort
              kannst du direkt einen Titel vergeben und das Preset mit der Maus,
              den Pfeiltasten oder 1–6 wählen. Esc oder ein Klick daneben
              schließt es.
            </FieldDescription>
            <div className="flex flex-wrap items-center gap-2.5">
              <HotkeyInput
                id="quick-action-hotkey"
                className="w-56"
                value={quickActionHotkey}
                invalid={menuHotkeyTaken}
                onChange={onQuickActionHotkeyChange}
              />
            </div>
            {menuHotkeyTaken ? (
              <FieldError>
                Dieses Tastenkürzel ist schon einem Preset zugeordnet.
              </FieldError>
            ) : null}
          </Field>
          <Field>
            <FieldLabel>Presets</FieldLabel>
            <FieldDescription>
              Länge für die Buttons oben in der App. Optional zusätzlich ein
              eigenes Tastenkürzel pro Preset.
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
                const hotkeyNormalized = draft.hotkey
                  ? normalizeHotkey(draft.hotkey)
                  : null;
                const duplicateHotkey =
                  hotkeyNormalized != null &&
                  duplicateHotkeys.has(hotkeyNormalized);
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
                          onUpdate(draft.id, "minutes", e.target.value)
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
                          onUpdate(draft.id, "seconds", e.target.value)
                        }
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>Sek</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    <HotkeyInput
                      id={`clip-preset-hotkey-${draft.id}`}
                      value={draft.hotkey}
                      invalid={duplicateHotkey}
                      onChange={(hotkey) =>
                        onUpdateHotkey(draft.id, hotkey)
                      }
                    />
                    <ButtonGroup>
                      <Button
                        type="button"
                        variant="outline"
                        aria-label="Nach oben"
                        disabled={index === 0}
                        onClick={() => onMove(index, -1)}
                      >
                        <ChevronUpIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        aria-label="Nach unten"
                        disabled={index === clipPresets.length - 1}
                        onClick={() => onMove(index, 1)}
                      >
                        <ChevronDownIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        aria-label="Entfernen"
                        disabled={clipPresets.length <= 1}
                        onClick={() => onRemove(draft.id)}
                      >
                        <Trash2Icon className="size-4 text-red-400" />
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
            {duplicateHotkeys.size > 0 ? (
              <FieldError>
                Jedes Tastenkürzel darf nur einmal vorkommen.
              </FieldError>
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
                onClick={onAdd}
              >
                <PlusIcon data-icon="inline-start" />
                Hinzufügen
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onReset(defaultPresetsForMax(maxSeconds))}
              >
                <RotateCcwIcon data-icon="inline-start" />
                Presets zurücksetzen
              </Button>
            </div>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
