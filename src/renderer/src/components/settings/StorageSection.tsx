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
import { StoragePanel } from "../StoragePanel";

interface StorageSectionProps {
  outputDir: string;
  onOutputDirChange: (value: string) => void;
  onBrowse: () => void;
}

export function StorageSection({
  outputDir,
  onOutputDirChange,
  onBrowse,
}: StorageSectionProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <FolderOutputIcon className="size-4" />
            Ausgabe
          </CardTitle>
          <CardDescription>
            Speicherordner für Clips. Sollte der gleiche Pfad wie der OBS
            ReplayBuffer Ausgabeordner sein.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                    onClick={onBrowse}
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
      <StoragePanel />
    </>
  );
}
