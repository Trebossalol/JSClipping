import { APP_NAME } from "@shared/app.config";
import { formatDuration } from "@/format";
import { CheckRow } from "./shared";

interface WelcomeStepProps {
  connected: boolean;
  setupReady: boolean;
  replayOff: boolean;
  replayMax: number | null;
  autostart: boolean;
}

export function WelcomeStep({
  connected,
  setupReady,
  replayOff,
  replayMax,
  autostart,
}: WelcomeStepProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground">
        Wenn OBS verbunden ist und der Wiederholungspuffer läuft, kannst du
        clippen. Die nächsten Schritte führen dich durch die Einrichtung.
      </p>
      <CheckRow
        ok={connected}
        label="OBS verbunden"
        detail={
          connected
            ? "Die Verbindung zu OBS steht."
            : "OBS ist nicht geöffnet, die Verbindung ist aus, oder Adresse und Passwort stimmen nicht."
        }
      />
      <CheckRow
        ok={setupReady}
        label="Wiederholungspuffer läuft"
        detail={
          setupReady
            ? replayMax != null
              ? `Läuft, maximal ${formatDuration(replayMax)}.`
              : "Läuft."
            : replayOff
              ? "OBS läuft, aber der Wiederholungspuffer ist aus. Starte ihn in OBS oder über den OBS-Status oben."
              : "Zuerst OBS verbinden."
        }
      />
      <CheckRow
        ok={autostart}
        label="Autostart (optional)"
        detail={
          autostart
            ? `${APP_NAME} und OBS starten mit Windows. Der Wiederholungspuffer ist dann schon an.`
            : "Ohne Autostart startest du OBS und den Wiederholungspuffer selbst."
        }
      />
    </div>
  );
}
