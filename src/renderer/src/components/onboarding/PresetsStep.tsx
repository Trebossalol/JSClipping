import { Badge } from "@/components/ui/badge";
import { APP_NAME } from "@shared/app.config";
import { formatDuration } from "@/format";
import { SettingsLink, type GoToSettings } from "./shared";

interface PresetsStepProps {
  presets: number[];
  replayMax: number | null;
  onGoToSettings: GoToSettings;
}

export function PresetsStep({
  presets,
  replayMax,
  onGoToSettings,
}: PresetsStepProps) {
  return (
    <>
      <p className="text-muted-foreground">
        Die Buttons oben in der Leiste sind genau diese Presets. {APP_NAME}{" "}
        speichert den Wiederholungspuffer und behält davon die gewählte Dauer —
        meist in unter einer Sekunde.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((seconds) => (
          <Badge key={seconds} variant="secondary">
            {formatDuration(seconds)}
          </Badge>
        ))}
      </div>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
        <li>1 bis 6 Presets, mindestens 5 Sekunden.</li>
        <li>
          Länger als der Wiederholungspuffer in OBS geht nicht
          {replayMax != null
            ? ` (aktuell höchstens ${formatDuration(replayMax)})`
            : " (die Obergrenze kommt von OBS, sobald verbunden)"}
          .
        </li>
        <li>
          Optional ein globales Tastenkürzel pro Preset — auch wenn die App im
          Hintergrund ist. Action Ring und CLI übergeben die Dauer weiterhin
          als Sekunden.
        </li>
      </ul>
      <SettingsLink onClick={() => onGoToSettings("presets")}>
        Presets
      </SettingsLink>
    </>
  );
}
