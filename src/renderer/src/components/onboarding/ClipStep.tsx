import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { APP_NAME } from "@shared/app.config";
import { formatDuration } from "@/format";
import { ClockIcon, KeyboardIcon, MousePointerClickIcon } from "lucide-react";

interface ClipStepProps {
  presets: number[];
  shortestPreset: number;
  replayMax: number | null;
  overBuffer: boolean;
  connected: boolean;
  replayOff: boolean;
  canClip: boolean;
  busy: boolean;
  onCreateClip: (seconds: number) => void;
}

export function ClipStep({
  presets,
  shortestPreset,
  replayMax,
  overBuffer,
  connected,
  replayOff,
  canClip,
  busy,
  onCreateClip,
}: ClipStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 font-medium">
          <MousePointerClickIcon className="size-4" />
          In der App
        </h3>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground">
          <li>
            Oben steht <strong className="text-foreground">OBS verbunden</strong>
            , nicht „Puffer aus“.
          </li>
          <li>Oben in der Leiste die gewünschte Dauer anklicken.</li>
          <li>
            Der Clip erscheint in der Bibliothek. Wenn du den Titel änderst,
            wird auch die Datei umbenannt.
          </li>
        </ol>
        <Button
          type="button"
          disabled={!canClip || overBuffer}
          title={
            overBuffer && replayMax != null
              ? `Länger als der Wiederholungspuffer (${formatDuration(replayMax)})`
              : replayOff
                ? "Wiederholungspuffer ist aus"
                : connected
                  ? `Letzte ${formatDuration(shortestPreset)} speichern`
                  : "OBS ist nicht verbunden"
          }
          onClick={() => onCreateClip(shortestPreset)}
        >
          {busy ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <ClockIcon data-icon="inline-start" />
          )}
          Testclip {formatDuration(shortestPreset)}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 font-medium">
          <KeyboardIcon className="size-4" />
          Taste oder Logitech Action Ring
        </h3>
        <p className="text-muted-foreground">
          Mit einer Logitech-Maus oder Tastatur (z. B. MX Master) kannst du
          einem Action-Ring-Segment eine Cliplänge zuweisen. In Logitech
          Options+: Anwendung öffnen → EasyClip.exe, als Zusatz z. B.{" "}
          <Badge variant="outline">--clip 30</Badge>. Die Zahl ist die Länge in
          Sekunden.
        </p>
        <p className="text-muted-foreground">
          Läuft {APP_NAME} schon im Hintergrund, wird der Clip dort gespeichert.
          Sonst startet die App, speichert den Clip und bleibt als Symbol neben
          der Uhr.
        </p>
        <div className="flex flex-col gap-2">
          {presets.map((seconds) => (
            <div
              key={seconds}
              className="flex items-center justify-between gap-2"
            >
              <span>Clip {formatDuration(seconds)}</span>
              <Badge variant="outline">--clip {seconds}</Badge>
            </div>
          ))}
        </div>
        <p className="text-muted-foreground">
          Auch <Badge variant="outline">--clip=30</Badge> funktioniert. Die
          Länge muss nicht zu einem Preset passen, darf aber nicht länger sein
          als der Wiederholungspuffer in OBS.
        </p>
      </div>
    </div>
  );
}
