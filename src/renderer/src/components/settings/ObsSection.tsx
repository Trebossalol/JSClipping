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
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { CableIcon, EyeIcon, EyeOffIcon, InfoIcon } from "lucide-react";

interface ObsSectionProps {
  url: string;
  password: string;
  showPassword: boolean;
  onUrlChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
}

export function ObsSection({
  url,
  password,
  showPassword,
  onUrlChange,
  onPasswordChange,
  onTogglePassword,
}: ObsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <CableIcon className="size-4" />
          OBS Verbindung
        </CardTitle>
        <CardDescription>Verbindungseinstellungen zum OBS WebSocket Server.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>Anleitung</AlertTitle>
          <AlertDescription>
          <ol className="list-decimal ml-5 space-y-1">
            <li>
              OBS Studio installieren: Stelle sicher, dass die neuste Version von OBS Studio installiert ist.
            </li>
            <li>
              Öffne OBS Studio und klicke auf Werkzeuge → WebSocket Server Einstellungen
            </li>
            <li>
              Setze oben das Häkchen bei <code>WebSocket-Server aktivieren</code>
            </li>
            <li>
              Denke dir ein Passwort aus und trage es in das Feld <code>Serverpasswort</code> ein.
              <br/>
              Speichere die Einstellungen und schließe das Fenster.
            </li>
            <li>
              Trage das gleiche Passwort in die Einstellungen von EasyClip ein und speichere die Einstellungen.
            </li>
          </ol>
          </AlertDescription>
        </Alert>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="obs-url">Server</FieldLabel>
            <Input
              id="obs-url"
              type="url"
              required
              autoComplete="off"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
            />
            <FieldDescription>
              Ändere diese Einstellung nur, wenn du weißt was du tust.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="obs-password">Passwort</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="obs-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="off"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  size="icon-xs"
                  onClick={onTogglePassword}
                  aria-label={
                    showPassword ? "Passwort verbergen" : "Passwort anzeigen"
                  }
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>
              Trage hier das gleiche Passwort wie in den OBS WebSocket Server Einstellungen ein.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
