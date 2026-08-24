import { useEffect, useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { FilmIcon } from "lucide-react";
import type { ClipRecord } from "@shared/ipc";
import { formatDate, formatDuration } from "../format";

interface ClipCardProps {
  clip: ClipRecord;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onReveal: (id: string) => void;
}

function ClipCard({ clip, onOpen, onRename, onReveal }: ClipCardProps) {
  const [name, setName] = useState(clip.name);

  useEffect(() => {
    setName(clip.name);
  }, [clip.name]);

  function commitRename(): void {
    if (name.trim() === clip.name) return;
    onRename(clip.id, name);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  }

  const duration = formatDuration(clip.durationSeconds);

  return (
    <Card className={clip.missing ? "opacity-60" : undefined}>
      <button
        type="button"
        className="relative block w-full overflow-hidden rounded-t-xl text-left"
        title={clip.missing ? "File missing" : "Open clip"}
        onClick={() => onOpen(clip.id)}
      >
        {clip.thumbnailPath && !clip.missing ? (
          <img
            src={clip.thumbnailPath}
            alt={clip.name}
            loading="lazy"
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-muted text-muted-foreground">
            <FilmIcon />
          </div>
        )}
        <div className="absolute right-2 bottom-2 flex gap-1">
          {duration ? <Badge variant="secondary">{duration}</Badge> : null}
          {clip.missing ? <Badge variant="destructive">Missing</Badge> : null}
          {!clip.namedByUser && !clip.missing ? (
            <Badge variant="outline">Untitled</Badge>
          ) : null}
        </div>
      </button>
      <CardHeader className="gap-2">
        <Input
          value={name}
          title="Edit title (also renames the file)"
          onChange={(e) => setName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={onKeyDown}
        />
        <CardDescription>{formatDate(clip.createdAt)}</CardDescription>
      </CardHeader>
      <CardFooter className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={!!clip.missing}
          onClick={() => onOpen(clip.id)}
        >
          Open
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => onReveal(clip.id)}
        >
          Show in folder
        </Button>
      </CardFooter>
    </Card>
  );
}

interface RecentClipsProps {
  clips: ClipRecord[];
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onReveal: (id: string) => void;
}

export function RecentClips({
  clips,
  onOpen,
  onRename,
  onReveal,
}: RecentClipsProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardTitle>Recent clips</CardTitle>
          <CardDescription>
            Rename a clip to update the file on disk.
          </CardDescription>
        </div>
        {clips.length > 0 ? (
          <Badge variant="secondary">
            {clips.length} clip{clips.length === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {clips.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FilmIcon />
              </EmptyMedia>
              <EmptyTitle>No clips yet</EmptyTitle>
              <EmptyDescription>
                Save a replay from OBS or press a clip button.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {clips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                onOpen={onOpen}
                onRename={onRename}
                onReveal={onReveal}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
