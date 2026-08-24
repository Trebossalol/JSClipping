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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Field,
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
import { ChevronsUpDownIcon, EyeIcon, EyeOffIcon, FolderIcon } from "lucide-react";
import { toast } from "sonner";
import type { AppConfigDto } from "@shared/ipc";

interface SettingsPanelProps {
  config: AppConfigDto;
  onSave: (config: AppConfigDto) => Promise<AppConfigDto>;
}

export function SettingsPanel({ config, onSave }: SettingsPanelProps) {
  const [open, setOpen] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [obsUrl, setObsUrl] = useState(config.OBS_URL);
  const [obsPassword, setObsPassword] = useState(config.OBS_PASSWORD);
  const [outputDir, setOutputDir] = useState(config.CLIP_OUTPUT_DIR);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setObsUrl(config.OBS_URL);
    setObsPassword(config.OBS_PASSWORD);
    setOutputDir(config.CLIP_OUTPUT_DIR);
  }, [config.OBS_URL, config.OBS_PASSWORD, config.CLIP_OUTPUT_DIR]);

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
      });
      setObsUrl(saved.OBS_URL);
      setObsPassword(saved.OBS_PASSWORD);
      setOutputDir(saved.CLIP_OUTPUT_DIR);
      toast.success("Settings saved.");
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      toast.error(text);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <CardTitle>Settings</CardTitle>
            <CardDescription>
              Shared with Action Ring via %APPDATA%\JSClipping\config.json
            </CardDescription>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" type="button">
              <ChevronsUpDownIcon />
              <span className="sr-only">Toggle settings</span>
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="obs-url">OBS WebSocket URL</FieldLabel>
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
                  <FieldLabel htmlFor="obs-password">OBS password</FieldLabel>
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
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor="clip-output-dir">Clip output folder</FieldLabel>
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
                        Browse
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>
                    New clips are stored under YYYY\MM inside this folder.
                  </FieldDescription>
                </Field>
                <Field>
                  <Button type="submit" disabled={saving}>
                    Save settings
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
