import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { APP_AUTHOR, APP_GITHUB_URL, APP_NAME } from "@shared/app.config";
import type { AppUpdateInfo } from "@shared/ipc";
import {
  ExternalLinkIcon,
  GitBranchIcon,
  InfoIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useSettingsForm } from "@/context/settings-form-context";

export function showUpdateAvailableToast(update: AppUpdateInfo): void {
  toast.info(`Version ${update.version} ist verfügbar.`, {
    action: {
      label: "Release öffnen",
      onClick: () => {
        void window.api.openExternal(update.url);
      },
    },
  });
}

export function AboutSection() {
  const { checkForUpdates, onCheckForUpdatesChange } = useSettingsForm();
  const [version, setVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void window.api.getVersion().then((value) => {
      if (!cancelled) setVersion(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function openGitHub(): Promise<void> {
    const result = await window.api.openExternal(APP_GITHUB_URL);
    if (!result.ok) {
      toast.error(result.error ?? "Link konnte nicht geöffnet werden.");
    }
  }

  async function checkNow(): Promise<void> {
    setChecking(true);
    try {
      const result = await window.api.checkForUpdates();
      if (!result.ok) {
        toast.error(result.error ?? "Update-Prüfung fehlgeschlagen.");
        return;
      }
      if (!result.update) {
        toast.success("Du verwendest die aktuelle Version.");
        return;
      }
      showUpdateAvailableToast(result.update);
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <InfoIcon className="size-4 text-primary opacity-80" />
          Über
        </CardTitle>
        <CardDescription>
          {APP_NAME} — OBS Clipping Software
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Entwickler</FieldLabel>
            <FieldDescription>{APP_AUTHOR}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel>Version</FieldLabel>
            <FieldDescription>{version ?? "…"}</FieldDescription>
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>GitHub</FieldLabel>
              <FieldDescription>
                Quellcode, Issues und Updates.
              </FieldDescription>
            </FieldContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => void openGitHub()}
            >
              <GitBranchIcon data-icon="inline-start" />
              Repository
              <ExternalLinkIcon data-icon="inline-end" />
            </Button>
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="check-for-updates">
                Beim Start auf Updates prüfen
              </FieldLabel>
              <FieldDescription>
                Prüft GitHub auf eine neue Version.
              </FieldDescription>
            </FieldContent>
            <Switch
              id="check-for-updates"
              checked={checkForUpdates}
              onCheckedChange={onCheckForUpdatesChange}
            />
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>Update-Prüfung</FieldLabel>
              <FieldDescription>
                Jetzt auf GitHub nach einer neuen Version suchen.
              </FieldDescription>
            </FieldContent>
            <Button
              type="button"
              variant="outline"
              disabled={checking}
              onClick={() => void checkNow()}
            >
              <RefreshCwIcon
                data-icon="inline-start"
                className={checking ? "animate-spin" : undefined}
              />
              Jetzt prüfen
            </Button>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
