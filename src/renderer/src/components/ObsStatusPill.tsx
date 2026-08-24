import { Badge } from "@/components/ui/badge";
import type { ObsStatus } from "@shared/ipc";

interface ObsStatusPillProps {
  status: ObsStatus | null;
}

export function ObsStatusPill({ status }: ObsStatusPillProps) {
  if (status == null) {
    return <Badge variant="secondary">Connecting…</Badge>;
  }

  if (status.connected) {
    return <Badge variant="secondary">OBS connected</Badge>;
  }

  return (
    <Badge variant="destructive" title={status.error ?? "Not connected"}>
      OBS disconnected
    </Badge>
  );
}
