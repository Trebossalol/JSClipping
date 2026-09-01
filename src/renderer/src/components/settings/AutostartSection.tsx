import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { APP_NAME } from "@shared/app.config";
import { InfoIcon, PowerIcon } from "lucide-react";

interface AutostartSectionProps {
  autostart: boolean;
  onAutostartChange: (value: boolean) => void;
  /** `null` while the packaged check is still loading. */
  available: boolean | null;
}

export function AutostartSection({
  autostart,
  onAutostartChange,
  available,
}: AutostartSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <PowerIcon className="size-4 text-primary opacity-80" />
          Autostart
        </CardTitle>
        <CardDescription>
          Startet {APP_NAME} und OBS mit Wiederholungspuffer, minimiert
          in den Infobereich.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {available === false ? (
          <Alert variant="info">
            <InfoIcon />
            <AlertTitle>Nur in der installierten App</AlertTitle>
            <AlertDescription>
              Autostart (Windows-Anmeldung und OBS) funktioniert nur in der
              installierten Version, nicht während der Entwicklung.
            </AlertDescription>
          </Alert>
        ) : null}
        <FieldGroup>
          <Field
            orientation="horizontal"
            data-disabled={available === true ? undefined : "true"}
          >
            <FieldContent>
              <FieldLabel htmlFor="autostart">
                Automatischer Start
              </FieldLabel>
              <FieldDescription>
                {APP_NAME} und OBS werden automatisch beim Windows-Start
                ausgeführt.
              </FieldDescription>
            </FieldContent>
            <Switch
              id="autostart"
              checked={autostart}
              onCheckedChange={onAutostartChange}
              disabled={available !== true}
            />
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
