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
}

export function AutostartSection({
  autostart,
  onAutostartChange,
}: AutostartSectionProps) {
  return (
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
      <CardContent className="flex flex-col gap-4">
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>Bald verfügbar</AlertTitle>
          <AlertDescription>
            Autostart wird in einem zukünftigen Update verfügbar sein.
          </AlertDescription>
        </Alert>
        <FieldGroup>
          <Field orientation="horizontal" data-disabled="true">
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
              onCheckedChange={onAutostartChange}
              disabled
            />
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
