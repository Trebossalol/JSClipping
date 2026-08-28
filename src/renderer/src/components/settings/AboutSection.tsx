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
import { APP_AUTHOR, APP_GITHUB_URL, APP_NAME } from "@shared/app.config";
import { ExternalLinkIcon, GitBranchIcon, InfoIcon } from "lucide-react";

export function AboutSection() {
  async function openGitHub(): Promise<void> {
    const result = await window.api.openExternal(APP_GITHUB_URL);
    if (!result.ok) {
      toast.error(result.error ?? "Link konnte nicht geöffnet werden.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <InfoIcon className="size-4" />
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
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
