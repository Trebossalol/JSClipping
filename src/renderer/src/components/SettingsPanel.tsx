import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import {
  CableIcon,
  EyeIcon,
  EyeOffIcon,
  FolderIcon,
  FolderOutputIcon,
  PlugIcon,
  PowerIcon,
  SaveIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { AppConfigDto } from "@shared/ipc";
import { Switch } from "@/components/ui/switch";

interface SettingsPanelProps {
  config: AppConfigDto;
  onSave: (config: AppConfigDto) => Promise<AppConfigDto>;
}

export function SettingsPanel({ config, onSave }: SettingsPanelProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [obsUrl, setObsUrl] = useState(config.OBS_URL);
  const [obsPassword, setObsPassword] = useState(config.OBS_PASSWORD);
  const [outputDir, setOutputDir] = useState(config.CLIP_OUTPUT_DIR);
  const [autostart, setAutostart] = useState(config.AUTOSTART);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setObsUrl(config.OBS_URL);
    setObsPassword(config.OBS_PASSWORD);
    setOutputDir(config.CLIP_OUTPUT_DIR);
    setAutostart(config.AUTOSTART);
  }, [
    config.OBS_URL,
    config.OBS_PASSWORD,
    config.CLIP_OUTPUT_DIR,
    config.AUTOSTART,
  ]);

  async function handleBrowse(): Promise<void> {
    const dir = await window.api.pickOutputDir();
    if (dir) setOutputDir(dir);
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await onSave({
        OBS_URL: obsUrl.trim(),
        OBS_PASSWORD: obsPassword,
        CLIP_OUTPUT_DIR: outputDir.trim(),
        AUTOSTART: autostart,
      });
      setObsUrl(saved.OBS_URL);
      setObsPassword(saved.OBS_PASSWORD);
      setOutputDir(saved.CLIP_OUTPUT_DIR);
      setAutostart(saved.AUTOSTART);
      toast.success("Einstellungen gespeichert.");
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      toast.error(text);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <PlugIcon className="size-3.5" />
          Verbindung
        </p>
        <p className="text-xs text-muted-foreground">
          Gemeinsam mit Action Ring über %APPDATA%\JSClipping\config.json
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <CableIcon className="size-4" />
            obs-websocket
          </CardTitle>
          <CardDescription>OBS WebSocket</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="obs-url">URL</FieldLabel>
              <Input
                id="obs-url"
                type="url"
                required
                autoComplete="off"
                value={obsUrl}
                onChange={(e) => setObsUrl(e.target.value)}
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
                  value={obsPassword}
                  onChange={(e) => setObsPassword(e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    size="icon-xs"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <FolderOutputIcon className="size-4" />
            Ausgabe
          </CardTitle>
          <CardDescription>Unterordner JJJJ\MM</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="clip-output-dir">Clip-Ausgabeordner</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="clip-output-dir"
                  type="text"
                  required
                  autoComplete="off"
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    size="xs"
                    onClick={() => void handleBrowse()}
                  >
                    <FolderIcon data-icon="inline-start" />
                    Durchsuchen
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                Neue Clips landen in Jahr/Monat-Ordnern. Umbenennen in der
                Bibliothek benennt auch die Datei um.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <PowerIcon className="size-4" />
            Autostart
          </CardTitle>
          <CardDescription>Beim Windows-Anmelden</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel htmlFor="autostart">
                  JSClipping und OBS im Clip-Modus
                </FieldLabel>
                <FieldDescription>
                  Startet JSClipping und OBS mit Wiederholungspuffer, minimiert
                  in den Infobereich.
                </FieldDescription>
              </FieldContent>
              <Switch
                id="autostart"
                checked={autostart}
                onCheckedChange={setAutostart}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <div>
        <Button type="submit" disabled={saving}>
          <SaveIcon data-icon="inline-start" />
          Einstellungen speichern
        </Button>
      </div>
    </form>
  );
}
