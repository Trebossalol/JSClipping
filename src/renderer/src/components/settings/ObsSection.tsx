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
        <CardDescription>Verbindung zu OBS ReplayBuffer</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>WebSocket aktivieren</AlertTitle>
          <AlertDescription>
            In OBS muss der WebSocket-Server eingeschaltet sein (Extras →
            WebSocket-Server-Einstellungen).
          </AlertDescription>
        </Alert>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="obs-url">URL</FieldLabel>
            <Input
              id="obs-url"
              type="url"
              required
              autoComplete="off"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
            />
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
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
