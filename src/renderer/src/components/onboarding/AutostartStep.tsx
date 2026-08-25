import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { APP_NAME } from "@shared/app.config";
import { InfoIcon } from "lucide-react";
import { SettingsLink, type GoToSettings } from "./shared";

interface AutostartStepProps {
  onGoToSettings: GoToSettings;
}

export function AutostartStep({ onGoToSettings }: AutostartStepProps) {
  return (
    <>
      <p className="text-muted-foreground">
        Praktisch, wenn du oft clippen willst, ohne vorher an OBS zu denken.
        Ein- und ausschalten geht unter Einstellungen → Autostart.
      </p>
      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>Fenster schließen beendet die App nicht</AlertTitle>
        <AlertDescription>
          {APP_NAME} bleibt als Symbol neben der Uhr. Zum Beenden: Rechtsklick
          auf das Symbol → Beenden. Eine Zahl auf dem Symbol zeigt Clips ohne
          Titel.
        </AlertDescription>
      </Alert>
      <SettingsLink onClick={() => onGoToSettings("autostart")}>
        Autostart
      </SettingsLink>
    </>
  );
}
