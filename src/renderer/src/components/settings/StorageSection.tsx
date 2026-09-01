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
import { FolderIcon, FolderOutputIcon, InfoIcon } from "lucide-react";
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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <FolderOutputIcon className="size-4 text-primary opacity-80" />
            Ausgabe
          </CardTitle>
          <CardDescription>
            Gleicher Ordner wie der OBS-Aufnahmepfad.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Alert variant="info">
            <InfoIcon />
            <AlertTitle>Anleitung</AlertTitle>
            <AlertDescription>
              <ol className="list-decimal ml-5 space-y-1">
                <li>
                  Öffne OBS Studio und gehe zu Datei → Einstellungen → Ausgabe → Aufnahme
                </li>
                <li>
                  Setze den <code>Aufnahmepfad</code> auf denselben Ordner wie
                  den Clip-Ausgabeordner oben.
                  <br />
                  Im Ausgabe-Modus <code>Erweitert</code> findest du den Pfad im
                  Reiter <code>Aufnahme</code>.
                </li>
                <li>
                  Speichere die Einstellungen in OBS mit <code>Anwenden</code>{" "}
                  und <code>OK</code>.
                </li>
              </ol>
            </AlertDescription>
          </Alert>
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
                Easy Clip überwacht diesen Ordner, um neue Clips zu erkennen,
                und sortiert sie nach Jahr und Monat.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
      <StoragePanel />
    </div>
  );
}
