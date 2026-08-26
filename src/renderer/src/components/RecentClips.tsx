import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  CalendarIcon,
  ClockIcon,
  FilePenIcon,
  FileQuestionIcon,
  FileXIcon,
  FilmIcon,
  FolderOpenIcon,
  HardDriveIcon,
  LayoutGridIcon,
  PlayIcon,
  ScissorsIcon,
  Trash2Icon,
} from "lucide-react";
import type { ClipRecord } from "@shared/ipc";
import { formatBytes, formatDate, formatDuration } from "../format";
import { DeleteClipDialog } from "./DeleteClipDialog";

const PAGE_SIZE = 12;

function pageItems(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, total]);
  for (let n = current - 1; n <= current + 1; n++) {
    if (n >= 1 && n <= total) pages.add(n);
  }
  if (current <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }
  if (current >= total - 2) {
    pages.add(total - 3);
    pages.add(total - 2);
    pages.add(total - 1);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const items: Array<number | "ellipsis"> = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) items.push("ellipsis");
    items.push(n);
    prev = n;
  }
  return items;
}

export type ClipFilter = "all" | "untitled";

interface ClipCardProps {
  clip: ClipRecord;
  selected: boolean;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onReveal: (id: string) => void;
  onDelete: (id: string) => void;
  onCut: (id: string) => void;
}

function ClipCard({
  clip,
  selected,
  onSelect,
  onOpen,
  onRename,
  onReveal,
  onDelete,
  onCut,
}: ClipCardProps) {
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
  const fileSize =
    clip.fileSizeBytes != null && clip.fileSizeBytes > 0
      ? formatBytes(clip.fileSizeBytes)
      : "";

  return (
    <Card
      className={cn(
        "gap-0 py-0",
        selected && "ring-2 ring-primary",
        clip.missing && "opacity-60",
      )}
    >
      <button
        type="button"
        className="relative block w-full overflow-hidden rounded-t-xl text-left"
        title={clip.missing ? "Datei fehlt" : "Clip öffnen"}
        onClick={() => {
          onSelect(clip.id);
          if (!clip.missing) onOpen(clip.id);
        }}
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
            {clip.missing ? (
              <span className="flex items-center gap-1 text-xs">
                <FileXIcon className="size-3.5" />
                Datei fehlt
              </span>
            ) : (
              <FilmIcon />
            )}
          </div>
        )}
        <div className="absolute inset-x-2 bottom-2 flex items-end justify-between gap-1">
          <Badge variant="secondary" className="max-w-[min(100%,11rem)] truncate">
            <CalendarIcon data-icon="inline-start" />
            {formatDate(clip.createdAt)}
          </Badge>
          <div className="flex min-w-0 flex-wrap justify-end gap-1">
            {duration ? (
              <Badge variant="secondary">
                <ClockIcon data-icon="inline-start" />
                {duration}
              </Badge>
            ) : null}
            {fileSize ? (
              <Badge variant="secondary">
                <HardDriveIcon data-icon="inline-start" />
                {fileSize}
              </Badge>
            ) : null}
            {clip.missing ? (
              <Badge variant="destructive">
                <FileXIcon data-icon="inline-start" />
                Fehlt
              </Badge>
            ) : null}
          </div>
        </div>
      </button>
      <div className="flex flex-col gap-2 p-2.5">
        <Input
          value={name}
          title="Titel bearbeiten (benennt auch die Datei um)"
          onChange={(e) => setName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={onKeyDown}
          onFocus={() => onSelect(clip.id)}
        />
        <ButtonGroup className="w-full">
          <ButtonGroup className="w-full">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="flex-1"
              disabled={!!clip.missing}
              onClick={() => onOpen(clip.id)}
            >
              <PlayIcon data-icon="inline-start" />
              Öffnen
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="flex-1"
              disabled={!!clip.missing}
              onClick={() => onCut(clip.id)}
            >
              <ScissorsIcon data-icon="inline-start" />
              Schneiden
            </Button>
          </ButtonGroup>
          <ButtonGroup>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Im Ordner anzeigen"
                  onClick={() => onReveal(clip.id)}
                >
                  <FolderOpenIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Im Ordner anzeigen</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="destructive"
                  aria-label="Löschen"
                  onClick={() => onDelete(clip.id)}
                >
                  <Trash2Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Löschen</TooltipContent>
            </Tooltip>
          </ButtonGroup>
        </ButtonGroup>
      </div>
    </Card>
  );
}

interface RecentClipsProps {
  clips: ClipRecord[];
  filter: ClipFilter;
  onFilterChange: (filter: ClipFilter) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onReveal: (id: string) => void;
  onDelete: (id: string) => void | Promise<void>;
  onCut: (id: string) => void;
}

export function RecentClips({
  clips,
  filter,
  onFilterChange,
  selectedId,
  onSelect,
  onOpen,
  onRename,
  onReveal,
  onDelete,
  onCut,
}: RecentClipsProps) {
  const [page, setPage] = useState(1);
  const [pageFilter, setPageFilter] = useState(filter);
  const newestId = clips[0]?.id;
  const [pageNewestId, setPageNewestId] = useState(newestId);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const visible =
    filter === "untitled"
      ? clips.filter((c) => !c.namedByUser && !c.missing)
      : clips;

  let nextPage = page;
  if (pageFilter !== filter || pageNewestId !== newestId) {
    setPageFilter(filter);
    setPageNewestId(newestId);
    nextPage = 1;
  }

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  if (nextPage > pageCount) {
    nextPage = pageCount;
  }
  if (nextPage !== page) {
    setPage(nextPage);
  }

  const currentPage = nextPage;
  const start = (currentPage - 1) * PAGE_SIZE;
  const paged = visible.slice(start, start + PAGE_SIZE);
  const from = visible.length === 0 ? 0 : start + 1;
  const to = start + paged.length;

  function goToPage(next: number): void {
    const clamped = Math.min(Math.max(1, next), pageCount);
    if (clamped === currentPage) return;
    setPage(clamped);
    sectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  const pendingClip = pendingDeleteId
    ? (clips.find((c) => c.id === pendingDeleteId) ?? null)
    : null;

  async function confirmDelete(): Promise<void> {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await onDelete(pendingDeleteId);
      setPendingDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div ref={sectionRef} className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <FilmIcon className="size-3.5" />
          Aktuelle Clips
        </p>
        <p className="text-xs text-muted-foreground">
          {clips.length} in der Bibliothek
        </p>
        <div className="ml-auto">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={filter}
            onValueChange={(value) => {
              if (value === "all" || value === "untitled") {
                onFilterChange(value);
              }
            }}
          >
            <ToggleGroupItem value="all">
              <LayoutGridIcon data-icon="inline-start" />
              Alle
            </ToggleGroupItem>
            <ToggleGroupItem value="untitled">
              <FilePenIcon data-icon="inline-start" />
              Unbenannt
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      {visible.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {clips.length === 0 ? <FilmIcon /> : <FileQuestionIcon />}
            </EmptyMedia>
            <EmptyTitle>
              {clips.length === 0 ? "Noch keine Clips" : "Keine unbenannten Clips"}
            </EmptyTitle>
            <EmptyDescription>
              {clips.length === 0
                ? "Speichere einen Replay aus OBS oder drücke eine Clip-Schaltfläche."
                : "Jeder Clip in der Bibliothek hat einen Titel."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17.5rem),1fr))] gap-3">
            {paged.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                selected={clip.id === selectedId}
                onSelect={onSelect}
                onOpen={onOpen}
                onRename={onRename}
                onReveal={onReveal}
                onDelete={(id) => setPendingDeleteId(id)}
                onCut={onCut}
              />
            ))}
          </div>
          {pageCount > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {from}–{to} von {visible.length}
              </p>
              <Pagination className="mx-0 w-auto justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      disabled={currentPage <= 1}
                      onClick={() => goToPage(currentPage - 1)}
                    />
                  </PaginationItem>
                  {pageItems(currentPage, pageCount).map((item, index) =>
                    item === "ellipsis" ? (
                      <PaginationItem key={`ellipsis-${index}`}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    ) : (
                      <PaginationItem key={item}>
                        <PaginationLink
                          isActive={item === currentPage}
                          aria-label={`Seite ${item}`}
                          onClick={() => goToPage(item)}
                        >
                          {item}
                        </PaginationLink>
                      </PaginationItem>
                    ),
                  )}
                  <PaginationItem>
                    <PaginationNext
                      disabled={currentPage >= pageCount}
                      onClick={() => goToPage(currentPage + 1)}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          ) : null}
        </>
      )}
      {pendingClip ? (
        <DeleteClipDialog
          clip={pendingClip}
          busy={deleting}
          onCancel={() => {
            if (!deleting) setPendingDeleteId(null);
          }}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}
