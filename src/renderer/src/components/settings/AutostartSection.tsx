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
import { PowerIcon } from "lucide-react";

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
      <CardContent>
        <FieldGroup>
          <Field orientation="horizontal">
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
            />
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
