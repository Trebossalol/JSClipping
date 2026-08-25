import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CircleCheckIcon, InfoIcon } from "lucide-react";
import { SettingsLink, type GoToSettings } from "./shared";

interface ObsStepProps {
  connected: boolean;
  onGoToSettings: GoToSettings;
}

export function ObsStep({ connected, onGoToSettings }: ObsStepProps) {
  return (
    <>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-muted-foreground">
        <li>OBS öffnen.</li>
        <li>
          <strong className="text-foreground">Extras → WebSocket-Server-Einstellungen</strong>
        </li>
        <li>
          <strong className="text-foreground">WebSocket-Server aktivieren</strong>{" "}
          einschalten.
        </li>
        <li>
          Port <Badge variant="secondary">4455</Badge> belassen — oder die
          Adresse in den Einstellungen anpassen.
        </li>
        <li>
          <strong className="text-foreground">Authentifizierung aktivieren</strong>
          , dann <strong className="text-foreground">Verbindungsinfo anzeigen</strong>{" "}
          und das Passwort unter OBS Verbindung eintragen.
        </li>
        <li>
          In OBS auf <strong className="text-foreground">Anwenden</strong> klicken.
        </li>
      </ol>
      {!connected ? (
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>Woran du erkennst, dass es klappt</AlertTitle>
          <AlertDescription>
            Oben sollte „OBS verbunden“ stehen. Bleibt der Status rot: OBS
            öffnen, den Server einschalten, Passwort und Port prüfen.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="info">
          <CircleCheckIcon />
          <AlertTitle>OBS ist verbunden</AlertTitle>
          <AlertDescription>
            Du kannst mit dem nächsten Schritt weitermachen.
          </AlertDescription>
        </Alert>
      )}
      <SettingsLink onClick={() => onGoToSettings("obs")}>
        OBS Verbindung
      </SettingsLink>
    </>
  );
}
