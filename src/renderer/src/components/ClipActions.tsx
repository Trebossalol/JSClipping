import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircleIcon } from "lucide-react";

const PRESETS = [
  { seconds: 30, label: "30s" },
  { seconds: 60, label: "1m" },
  { seconds: 300, label: "5m" },
  { seconds: 600, label: "10m" },
] as const;

interface ClipActionsProps {
  busy: boolean;
  message: { text: string; kind: "ok" | "err" } | null;
  onCreate: (seconds: number) => void;
}

export function ClipActions({ busy, message, onCreate }: ClipActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create clip</CardTitle>
        <CardDescription>
          Save the last N seconds from the OBS replay buffer.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(({ seconds, label }) => (
            <Button
              key={seconds}
              type="button"
              disabled={busy}
              onClick={() => onCreate(seconds)}
            >
              {label}
            </Button>
          ))}
        </div>
        {busy ? (
          <Alert>
            <Spinner />
            <AlertTitle>Working</AlertTitle>
            <AlertDescription>Saving clip…</AlertDescription>
          </Alert>
        ) : null}
        {message && !busy ? (
          <Alert variant={message.kind === "err" ? "destructive" : "default"}>
            {message.kind === "err" ? <AlertCircleIcon /> : null}
            <AlertTitle>{message.kind === "err" ? "Error" : "Status"}</AlertTitle>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
