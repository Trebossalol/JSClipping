import { APP_NAME } from "@shared/app.config";
import {
  CableIcon,
  ClockIcon,
  FolderOutputIcon,
  LibraryIcon,
  MousePointerClickIcon,
  PowerIcon,
} from "lucide-react";

export const ONBOARDING_STEPS = [
  {
    title: "Überblick",
    heading: "Erste Schritte",
    description: `${APP_NAME} speichert aus OBS die letzten Sekunden als Clip — mit einem Klick in der App oder über eine Taste.`,
    icon: LibraryIcon,
  },
  {
    title: "OBS",
    heading: "OBS mit der App verbinden",
    description: `${APP_NAME} braucht eine Verbindung zu OBS. Dafür schaltest du in OBS den WebSocket-Server ein (ab OBS 28).`,
    icon: CableIcon,
  },
  {
    title: "Puffer",
    heading: "Wiederholungspuffer und Ordner",
    description: `${APP_NAME} nimmt nicht selbst auf. Es speichert nur, was OBS gerade im Wiederholungspuffer bereithält. Beide Programme müssen denselben Ordner nutzen.`,
    icon: FolderOutputIcon,
  },
  {
    title: "Autostart",
    heading: "Autostart",
    description: `Beim Start von Windows öffnet sich ${APP_NAME} im Hintergrund und startet OBS mit Wiederholungspuffer, falls OBS noch nicht läuft.`,
    icon: PowerIcon,
  },
  {
    title: "Presets",
    heading: "Was Presets sind",
    description:
      "Ein Preset ist eine fertige Cliplänge: „die letzten 30 Sekunden“, „die letzte Minute“ und so weiter.",
    icon: ClockIcon,
  },
  {
    title: "Clippen",
    heading: "Clippen: in der App oder per Taste",
    description: "Zwei Wege, denselben Clip in der Bibliothek zu speichern.",
    icon: MousePointerClickIcon,
  },
  {
    title: "Fertig",
    heading: "Danach in der Bibliothek",
    description: "Clips ansehen, umbenennen und kürzen.",
    icon: LibraryIcon,
  },
] as const;
