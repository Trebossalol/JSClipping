import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { FolderIcon, FolderOutputIcon } from "lucide-react";
import { StoragePanel } from "./StoragePanel";
import { useSettingsForm } from "@/context/settings-form-context";

export function StorageSection() {
  const {
    outputDir,
    onOutputDirChange,
    onBrowseOutputDir,
  } = useSettingsForm();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <FolderOutputIcon className="size-4 text-primary opacity-80" />
            Ausgabe
          </CardTitle>
          <CardDescription>
            Gleicher Ordner wie der Aufnahmepfad von OBS Studio.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="clip-output-dir">
                Clip-Ausgabeordner
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="clip-output-dir"
                  type="text"
                  required
                  autoComplete="off"
                  value={outputDir}
                  onChange={(e) => onOutputDirChange(e.target.value)}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    size="xs"
                    onClick={onBrowseOutputDir}
                  >
                    <FolderIcon data-icon="inline-start" />
                    Durchsuchen
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldDescription>
                Easy Clip überwacht diesen Ordner, um neue Clips zu erkennen.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
      <StoragePanel />
    </div>
  );
}
