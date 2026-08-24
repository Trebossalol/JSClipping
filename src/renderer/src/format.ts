export function formatDuration(seconds: number | null): string {
  if (seconds == null || Number.isNaN(seconds)) return "";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const now = new Date();
    const time = d.toLocaleTimeString("de-DE", {
      hour: "numeric",
      minute: "2-digit",
    });
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const startOfThat = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
    ).getTime();
    const dayDiff = Math.round((startOfToday - startOfThat) / 86_400_000);
    if (dayDiff === 0) return `Heute, ${time}`;
    if (dayDiff === 1) return `Gestern, ${time}`;
    return d.toLocaleString("de-DE", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
