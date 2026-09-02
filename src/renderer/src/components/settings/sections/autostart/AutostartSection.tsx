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
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { APP_NAME } from "@shared/app.config";
import { InfoIcon, PowerIcon } from "lucide-react";
import { useSettingsForm } from "@/context/settings-form-context";

export function AutostartSection() {
  const {
    autostart,
    onAutostartChange,
    autostartAvailable,
  } = useSettingsForm();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <PowerIcon className="size-4 text-primary opacity-80" />
          Autostart
        </CardTitle>
        <CardDescription>
          Startet {APP_NAME} uns OBS automatisch beim Windows-Start.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {autostartAvailable === false ? (
          <Alert variant="warning">
            <InfoIcon />
            <AlertTitle>Nicht verfügbar</AlertTitle>
            <AlertDescription>
              In der Entwicklungsumgebung ist diese Funktion nicht verfügbar.
            </AlertDescription>
          </Alert>
        ) : null}
        <FieldGroup>
          <Field
            orientation="horizontal"
            data-disabled={autostartAvailable === true ? undefined : "true"}
          >
            <FieldContent>
              <FieldLabel htmlFor="autostart">
                Automatischer Start
              </FieldLabel>
            </FieldContent>
            <Switch
              id="autostart"
              checked={autostart}
              onCheckedChange={onAutostartChange}
              disabled={autostartAvailable !== true}
            />
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
