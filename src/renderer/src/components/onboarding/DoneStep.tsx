import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { APP_NAME } from "@shared/app.config";
import { Trouble } from "./shared";

interface DoneStepProps {
  hideChecked: boolean;
  hiding: boolean;
  onRequestHide: (checked: boolean) => void;
}

export function DoneStep({
  hideChecked,
  hiding,
  onRequestHide,
}: DoneStepProps) {
  return (
    <>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted-foreground">
        <li>
          Ein Klick auf die Vorschau spielt den Clip in deinem üblichen Player.
        </li>
        <li>Wenn du den Titel änderst, wird auch die Datei umbenannt.</li>
        <li>
          <strong className="text-foreground">Schneiden</strong> öffnet ein extra
          Fenster: Bereiche behalten, an der Abspielposition teilen, als neue
          Datei speichern. Das Original bleibt.
        </li>
        <li>
          Neue Videos im Ausgabeordner erscheinen von selbst in der Bibliothek.
        </li>
      </ul>
      <div className="flex flex-col gap-3">
        <p className="font-medium">Wenn etwas nicht klappt</p>
        <Trouble
          symptom="Oben steht „OBS getrennt“"
          fix="OBS geöffnet? Unter Extras den WebSocket-Server einschalten? Passwort und Port unter OBS Verbindung prüfen."
        />
        <Trouble
          symptom="Oben steht „Puffer aus“ oder die Clip-Buttons lassen sich nicht klicken"
          fix="In OBS den Wiederholungspuffer starten. Oder oben auf den OBS-Status klicken und OBS starten. Mit Autostart passiert das beim nächsten Windows-Start von allein."
        />
        <Trouble
          symptom="Ein Preset ist ausgegraut"
          fix="In OBS die maximale Wiederholungszeit erhöhen oder das Preset kürzer machen."
        />
        <Trouble
          symptom="Die Taste oder der Action Ring tut nichts"
          fix={`Als Zusatz genau --clip 30 eintragen (Zahl = Sekunden). ${APP_NAME} darf schon im Hintergrund laufen.`}
        />
        <Trouble
          symptom="Autostart startet OBS nicht"
          fix="OBS liegt normalerweise unter C:\Program Files\obs-studio. Wenn du OBS woanders installiert hast, findet die App es möglicherweise nicht."
        />
      </div>
      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox
            id="hide-onboarding"
            checked={hideChecked}
            disabled={hiding}
            onCheckedChange={(checked) => onRequestHide(checked === true)}
          />
          <FieldContent>
            <FieldLabel htmlFor="hide-onboarding">
              Einrichtung ausblenden
            </FieldLabel>
            <FieldDescription>
              Dann verschwindet sie aus dem Menü.
            </FieldDescription>
          </FieldContent>
        </Field>
      </FieldGroup>
    </>
  );
}
