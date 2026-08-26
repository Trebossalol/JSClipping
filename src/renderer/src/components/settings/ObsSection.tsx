import { useEffect, useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { DropdownMenuLabel } from "../ui/dropdown-menu";

interface ObsSectionProps {
  url: string;
  password: string;
  scene: string;
  showPassword: boolean;
  onUrlChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSceneChange: (value: string) => void;
  onTogglePassword: () => void;
}

const selectClassName = cn(
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50",
  "md:text-sm dark:bg-input/30",
);

export function ObsSection({
  url,
  password,
  scene,
  showPassword,
  onUrlChange,
  onPasswordChange,
  onSceneChange,
  onTogglePassword,
}: ObsSectionProps) {
  const [scenes, setScenes] = useState<string[]>([]);
  const [obsConnected, setObsConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadScenes(): Promise<void> {
      const [status, listed] = await Promise.all([
        window.api.getObsStatus(),
        window.api.getObsScenes(),
      ]);
      if (cancelled) return;
      setObsConnected(status.connected);
      if (listed.ok) setScenes(listed.scenes);
    }

    void loadScenes();
    const unsub = window.api.onObsStatus((status) => {
      setObsConnected(status.connected);
      if (status.connected) void loadScenes();
      else setScenes([]);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const sceneOptions = useMemo(() => {
    const names = [...scenes];
    const selected = scene.trim();
    if (selected && !names.includes(selected)) names.unshift(selected);
    return names;
  }, [scene, scenes]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <CableIcon className="size-4" />
          OBS Verbindung
        </CardTitle>
        <CardDescription>
          Verbindungseinstellungen zum OBS WebSocket Server.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>Anleitung</AlertTitle>
          <AlertDescription>
            <ol className="ml-5 list-decimal space-y-1">
              <li>
                OBS Studio installieren: Stelle sicher, dass die neuste Version
                von OBS Studio installiert ist.
              </li>
              <li>
                Öffne OBS Studio und klicke auf Werkzeuge → WebSocket Server
                Einstellungen
              </li>
              <li>
                Setze oben das Häkchen bei{" "}
                <code>WebSocket-Server aktivieren</code>
              </li>
              <li>
                Denke dir ein Passwort aus und trage es in das Feld{" "}
                <code>Serverpasswort</code> ein.
                <br />
                Speichere die Einstellungen und schließe das Fenster.
              </li>
              <li>
                Trage das gleiche Passwort in die Einstellungen von EasyClip ein
                und speichere die Einstellungen.
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
              Trage hier das gleiche Passwort wie in den OBS WebSocket Server
              Einstellungen ein.
            </FieldDescription>
          </Field>

          <div className="my-1 border-t border-border" />

          <Alert variant="info">
            <InfoIcon />
            <AlertDescription>
                Wenn du eine bestimmte Aufnahmeszene für deine Clips in OBS konfiguriert hast, kannst du sie hier auswählen.
            </AlertDescription>
          </Alert>

          <Field>
            <FieldLabel htmlFor="obs-scene">Aufnahmeszene</FieldLabel>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="justify-start text-muted-foreground" disabled={!obsConnected}>
                  {scene || "Keine Szene ausgewählt"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {sceneOptions.map((name) => (
                  <DropdownMenuItem key={name} onClick={() => onSceneChange(name)}>
                    {name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <FieldDescription>
              {obsConnected
                ? "Easy Clip verwendet diese OBS-Szene für die Aufnahme von Clips."
                : "Verbinde OBS um eine Szene auszuwählen."}
            </FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
