import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import {
  CableIcon,
  EyeIcon,
  EyeOffIcon,
  FilmIcon,
  FolderIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { formatDuration } from "@/format";
import {
  MAX_OBS_REPLAY_SECONDS,
  MIN_OBS_REPLAY_SECONDS,
} from "@shared/app.config";

interface ObsSectionProps {
  url: string;
  password: string;
  exePath: string;
  scene: string;
  replayMinutes: string;
  replaySeconds: string;
  replayInvalid: boolean;
  liveReplaySeconds: number | null;
  showPassword: boolean;
  onUrlChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onExePathChange: (value: string) => void;
  onBrowseExe: () => void;
  onSceneChange: (value: string) => void;
  onReplayMinutesChange: (value: string) => void;
  onReplaySecondsChange: (value: string) => void;
  onTogglePassword: () => void;
}

export function ObsSection({
  url,
  password,
  exePath,
  scene,
  replayMinutes,
  replaySeconds,
  replayInvalid,
  liveReplaySeconds,
  showPassword,
  onUrlChange,
  onPasswordChange,
  onExePathChange,
  onBrowseExe,
  onSceneChange,
  onReplayMinutesChange,
  onReplaySecondsChange,
  onTogglePassword,
}: ObsSectionProps) {
  const [scenes, setScenes] = useState<string[]>([]);
  const [obsConnected, setObsConnected] = useState(false);
  const setupPending = password === "CHANGE_ME";

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
    <div className="flex flex-col gap-4">
      <Accordion
        type="single"
        collapsible
        defaultValue={setupPending ? "server" : undefined}
      >
        <Card>
          <AccordionItem value="server" className="border-0">
            <CardHeader>
              <AccordionTrigger className="py-0 hover:no-underline">
                <CardTitle className="flex items-center gap-1.5">
                  <CableIcon className="size-4" />
                  Server
                </CardTitle>
              </AccordionTrigger>
              <CardDescription>
                Verbindungseinstellungen zum OBS WebSocket Server.
              </CardDescription>
            </CardHeader>
            <AccordionContent>
              <CardContent className="flex flex-col gap-4 pt-4">
                <Alert variant="info">
                  <InfoIcon />
                  <AlertTitle>Anleitung</AlertTitle>
                  <AlertDescription>
                    <ol className="ml-5 list-decimal space-y-1">
                      <li>
                        OBS Studio installieren: Stelle sicher, dass die neuste
                        Version von OBS Studio installiert ist.
                      </li>
                      <li>
                        Öffne OBS Studio und klicke auf Werkzeuge → WebSocket
                        Server Einstellungen
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
                        Trage das gleiche Passwort in die Einstellungen von
                        EasyClip ein und speichere die Einstellungen.
                      </li>
                    </ol>
                  </AlertDescription>
                </Alert>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="obs-url">Server</FieldLabel>
                    <Input
                      id="obs-url"
                      type="text"
                      inputMode="url"
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
                            showPassword
                              ? "Passwort verbergen"
                              : "Passwort anzeigen"
                          }
                        >
                          {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldDescription>
                      Trage hier das gleiche Passwort wie in den OBS WebSocket
                      Server Einstellungen ein.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="obs-exe-path">
                      OBS-Programmdatei
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="obs-exe-path"
                        type="text"
                        autoComplete="off"
                        placeholder="C:\Program Files\obs-studio\bin\64bit\obs64.exe"
                        value={exePath}
                        onChange={(e) => onExePathChange(e.target.value)}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          type="button"
                          size="xs"
                          onClick={onBrowseExe}
                        >
                          <FolderIcon data-icon="inline-start" />
                          Durchsuchen
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldDescription>
                      Leer lassen, wenn OBS unter C:\Program Files liegt.
                      Sonst die Datei obs64.exe wählen — etwa auf einem anderen
                      Laufwerk.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </CardContent>
            </AccordionContent>
          </AccordionItem>
        </Card>
      </Accordion>

      <Accordion type="single" collapsible defaultValue="recording">
        <Card>
          <AccordionItem value="recording" className="border-0">
            <CardHeader>
              <AccordionTrigger className="py-0 hover:no-underline">
                <CardTitle className="flex items-center gap-1.5">
                  <FilmIcon className="size-4" />
                  Aufnahme
                </CardTitle>
              </AccordionTrigger>
            </CardHeader>
            <AccordionContent>
              <CardContent className="flex flex-col gap-4 pt-4">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="obs-scene">Aufnahmeszene</FieldLabel>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={
                            scene
                              ? "justify-start"
                              : "justify-start text-muted-foreground"
                          }
                          disabled={!obsConnected}
                        >
                          {scene || "Keine Szene ausgewählt"}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => onSceneChange("")}>
                          Keine Szene
                        </DropdownMenuItem>
                        {sceneOptions.map((name) => (
                          <DropdownMenuItem
                            key={name}
                            onClick={() => onSceneChange(name)}
                          >
                            {name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <FieldDescription>
                      Diese Szene wird für die Clipaufnahme verwendet.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="obs-replay-min">
                      Wiederholungspuffer
                    </FieldLabel>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <InputGroup className="w-28">
                        <InputGroupInput
                          id="obs-replay-min"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={Math.floor(MAX_OBS_REPLAY_SECONDS / 60)}
                          step={1}
                          aria-label="Minuten"
                          aria-invalid={replayInvalid}
                          value={replayMinutes}
                          onChange={(e) => onReplayMinutesChange(e.target.value)}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>Min</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                      <InputGroup className="w-28">
                        <InputGroupInput
                          id="obs-replay-sec"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={59}
                          step={1}
                          aria-label="Sekunden"
                          aria-invalid={replayInvalid}
                          value={replaySeconds}
                          onChange={(e) => onReplaySecondsChange(e.target.value)}
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>Sek</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                    </div>
                    {replayInvalid ? (
                      <FieldError>
                        Die Pufferdauer muss zwischen{" "}
                        {formatDuration(MIN_OBS_REPLAY_SECONDS)} und{" "}
                        {formatDuration(MAX_OBS_REPLAY_SECONDS)} liegen.
                      </FieldError>
                    ) : (
                      <FieldDescription>
                        Dieser Wert sollte so groß sein, wie die maximale Clip-Länge.
                      </FieldDescription>
                    )}
                  </Field>
                  <Alert variant={'warning'}>
                      <TriangleAlertIcon/>
                    <AlertDescription>
                    Bitte beachte, dass ein höherer Wert mehr Arbeitsspeicher benötigt. Um die geschätzte Arbeitsspeichermenge einzusehen, 
                    öffne OBS und klicke auf Datei → Einstellungen → Ausgabe → Replaypuffer.
                    </AlertDescription>
                  </Alert>
                </FieldGroup>
              </CardContent>
            </AccordionContent>
          </AccordionItem>
        </Card>
      </Accordion>
    </div>
  );
}
