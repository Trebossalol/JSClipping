import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TriangleAlertIcon } from "lucide-react";
import { SettingsLink, type GoToSettings } from "./shared";

interface BufferStepProps {
  outputDir: string;
  onGoToSettings: GoToSettings;
}

export function BufferStep({ outputDir, onGoToSettings }: BufferStepProps) {
  return (
    <>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground">
        <li>
          OBS → <strong className="text-foreground">Einstellungen → Ausgabe</strong>
        </li>
        <li>
          Bei Bedarf Ausgabe-Modus{" "}
          <strong className="text-foreground">Erweitert</strong>, dann Reiter{" "}
          <strong className="text-foreground">Wiederholungspuffer</strong>.
        </li>
        <li>
          <strong className="text-foreground">Wiederholungspuffer</strong>{" "}
          aktivieren.
        </li>
        <li>
          <strong className="text-foreground">Maximale Wiederholungszeit</strong>{" "}
          mindestens so lang wie dein längstes Preset (für 10 Minuten:{" "}
          <Badge variant="secondary">600</Badge> Sekunden).
        </li>
        <li>
          Den Ordner für Aufnahmen auf denselben Pfad setzen wie unter Speicher
          (aktuell {outputDir}).
        </li>
        <li>
          In OBS <strong className="text-foreground">Wiederholungspuffer starten</strong>
          . Du kannst OBS auch oben über den OBS-Status starten — dann geht der
          Wiederholungspuffer gleich mit an.
        </li>
      </ol>
      <Alert>
        <TriangleAlertIcon />
        <AlertTitle>Ohne Wiederholungspuffer kein Clip</AlertTitle>
        <AlertDescription>
          Oben steht dann „Puffer aus“. Eine Cliplänge, die länger ist als die
          maximale Wiederholungszeit in OBS, lässt sich nicht anklicken.
        </AlertDescription>
      </Alert>
      <SettingsLink onClick={() => onGoToSettings("storage")}>
        Speicher
      </SettingsLink>
    </>
  );
}
