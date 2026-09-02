import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  MonitorIcon,
  MoreHorizontalIcon,
  PlayIcon,
  ScissorsIcon,
  TagsIcon,
  Trash2Icon,
} from "lucide-react";
import type { ClipRecord, TagRecord } from "@shared/ipc";
import { clipTagIds } from "@shared/tags/names";
import {
  formatBytes,
  formatDate,
  formatDuration,
  formatPixels,
  formatResolution,
} from "@/format";
import { DeleteClipDialog } from "./DeleteClipDialog";
import { ClipTagPicker } from "./settings/sections/tags/ClipTagPicker";

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

export type ClipFilter = "all" | "untitled" | "last24h";

const DAY_MS = 24 * 60 * 60 * 1000;

function isLast24h(createdAt: string): boolean {
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) && Date.now() - t <= DAY_MS;
}

const UNTAGGED_FILTER = "untagged";

function filterClips(
  clips: ClipRecord[],
  filter: ClipFilter,
  tagIds: string[],
  untaggedOnly: boolean,
): ClipRecord[] {
  let next = clips;
  if (filter === "untitled") {
    next = next.filter((c) => !c.namedByUser && !c.missing);
  } else if (filter === "last24h") {
    next = next.filter((c) => isLast24h(c.createdAt));
  }
  if (untaggedOnly) {
    return next.filter((c) => clipTagIds(c).length === 0);
  }
  if (tagIds.length > 0) {
    const wanted = new Set(tagIds);
    return next.filter((c) => clipTagIds(c).some((id) => wanted.has(id)));
  }
  return next;
}

interface ClipCardProps {
  clip: ClipRecord;
  tags: TagRecord[];
  selected: boolean;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onReveal: (id: string) => void;
  onDelete: (id: string) => void;
  onCut: (id: string) => void;
  onSetTags: (id: string, tagIds: string[]) => void | Promise<void>;
  onCreateTag: (name: string) => Promise<TagRecord | null>;
}

function ClipCard({
  clip,
  tags,
  selected,
  onSelect,
  onOpen,
  onRename,
  onReveal,
  onDelete,
  onCut,
  onSetTags,
  onCreateTag,
}: ClipCardProps) {
  const [name, setName] = useState(clip.name);
  const assignedIds = clipTagIds(clip);
  const assignedTags = tags.filter((tag) => assignedIds.includes(tag.id));

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
  const resolution = formatResolution(clip.width, clip.height);
  const pixels = formatPixels(clip.width, clip.height);
  const fileSize =
    clip.fileSizeBytes != null && clip.fileSizeBytes > 0
      ? formatBytes(clip.fileSizeBytes)
      : "";

  return (
    <Card
      className={cn(
        "gap-0 py-0 transition-shadow",
        selected &&
        "ring-2 ring-primary shadow-[0_0_24px_color-mix(in_srgb,var(--primary)_28%,transparent)]",
        clip.missing && "opacity-60",
      )}
    >
      <div className="group/thumb relative">
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
                  <FileXIcon className="size-3.5 opacity-70" />
                  Datei fehlt
                </span>
              ) : (
                <FilmIcon className="opacity-50" />
              )}
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-t from-background/85 via-background/15 to-transparent"
            aria-hidden
          />
          {resolution ? (
            <div className="absolute top-2 left-2 z-10">
              {pixels && pixels !== resolution ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="secondary"
                      className="glass border-white/15 bg-background/40"
                    >
                      <MonitorIcon
                        data-icon="inline-start"
                        className="opacity-70"
                      />
                      {resolution}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>{pixels}</TooltipContent>
                </Tooltip>
              ) : (
                <Badge
                  variant="secondary"
                  className="glass border-white/15 bg-background/40"
                >
                  <MonitorIcon
                    data-icon="inline-start"
                    className="opacity-70"
                  />
                  {resolution}
                </Badge>
              )}
            </div>
          ) : null}
          {!clip.namedByUser && !clip.missing ? (
            <div className="absolute top-2 right-2 z-10">
              <Badge className="bg-primary/85 text-primary-foreground">
                <FilePenIcon data-icon="inline-start" className="opacity-80" />
                Unbenannt
              </Badge>
            </div>
          ) : null}
          <div className="absolute inset-x-2 bottom-2 z-10 flex items-end justify-between gap-1">
            <Badge
              variant="secondary"
              className="glass max-w-[min(100%,11rem)] truncate border-white/15 bg-background/40"
            >
              <CalendarIcon data-icon="inline-start" className="opacity-70" />
              {formatDate(clip.createdAt)}
            </Badge>
            <div className="flex min-w-0 flex-wrap justify-end gap-1">
              {duration ? (
                <Badge
                  variant="secondary"
                  className="glass border-white/15 bg-background/40"
                >
                  <ClockIcon data-icon="inline-start" className="opacity-70" />
                  {duration}
                </Badge>
              ) : null}
              {fileSize ? (
                <Badge
                  variant="secondary"
                  className="glass border-white/15 bg-background/40"
                >
                  <HardDriveIcon
                    data-icon="inline-start"
                    className="opacity-70"
                  />
                  {fileSize}
                </Badge>
              ) : null}
              {clip.missing ? (
                <Badge variant="destructive">
                  <FileXIcon data-icon="inline-start" className="opacity-70" />
                  Fehlt
                </Badge>
              ) : null}
            </div>
          </div>
        </button>
        {!clip.missing ? (
          <div
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-2 bg-background/25 opacity-0 transition-opacity group-hover/thumb:pointer-events-auto group-hover/thumb:opacity-100"
            onClick={() => {
              onSelect(clip.id);
              onOpen(clip.id);
            }}
          >
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="glass size-10 border-white/15 shadow-lg"
              aria-label="Öffnen"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(clip.id);
                onOpen(clip.id);
              }}
            >
              <PlayIcon className="opacity-80" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="glass size-10 border-white/15 shadow-lg"
              aria-label="Schneiden"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(clip.id);
                onCut(clip.id);
              }}
            >
              <ScissorsIcon className="opacity-80" />
            </Button>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5 p-2.5">
        <div className="flex items-center gap-1.5">
          <Input
            value={name}
            title="Titel bearbeiten (benennt auch die Datei um)"
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={onKeyDown}
            onFocus={() => onSelect(clip.id)}
          />
          <ClipTagPicker
            assignedIds={assignedIds}
            tags={tags}
            onSetTags={(tagIds) => onSetTags(clip.id, tagIds)}
            onCreateTag={onCreateTag}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="shrink-0 text-muted-foreground"
                aria-label="Weitere Aktionen"
              >
                <MoreHorizontalIcon className="opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={!!clip.missing}
                onSelect={() => onOpen(clip.id)}
              >
                <PlayIcon className="opacity-70" />
                Öffnen
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!!clip.missing}
                onSelect={() => onCut(clip.id)}
              >
                <ScissorsIcon className="opacity-70" />
                Schneiden
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onReveal(clip.id)}>
                <FolderOpenIcon className="opacity-70" />
                Im Ordner anzeigen
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onDelete(clip.id)}
              >
                <Trash2Icon />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {assignedTags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {assignedTags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="max-w-full">
                <TagsIcon data-icon="inline-start" className="opacity-70" />
                <span className="truncate">{tag.name}</span>
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

interface RecentClipsProps {
  clips: ClipRecord[];
  tags: TagRecord[];
  filter: ClipFilter;
  onFilterChange: (filter: ClipFilter) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onReveal: (id: string) => void;
  onDelete: (id: string) => void | Promise<void>;
  onCut: (id: string) => void;
  onSetTags: (id: string, tagIds: string[]) => void | Promise<void>;
  onCreateTag: (name: string) => Promise<TagRecord | null>;
}

export function RecentClips({
  clips,
  tags,
  filter,
  onFilterChange,
  selectedId,
  onSelect,
  onOpen,
  onRename,
  onReveal,
  onDelete,
  onCut,
  onSetTags,
  onCreateTag,
}: RecentClipsProps) {
  const [page, setPage] = useState(1);
  const [pageKey, setPageKey] = useState("");
  const newestId = clips[0]?.id;
  const [pageNewestId, setPageNewestId] = useState(newestId);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [tagFilterIds, setTagFilterIds] = useState<string[]>([]);
  const [untaggedOnly, setUntaggedOnly] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const knownTagIds = new Set(tags.map((tag) => tag.id));
  const activeTagIds = tagFilterIds.filter((id) => knownTagIds.has(id));
  const visible = filterClips(clips, filter, activeTagIds, untaggedOnly);
  const filterKey = `${filter}:${untaggedOnly ? UNTAGGED_FILTER : activeTagIds.slice().sort().join(",")}`;

  let nextPage = page;
  if (pageKey !== filterKey || pageNewestId !== newestId) {
    setPageKey(filterKey);
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
    <div ref={sectionRef} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <FilmIcon className="size-3.5 opacity-70" />
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
              if (value === "all" || value === "untitled" || value === "last24h") {
                onFilterChange(value);
              }
            }}
          >
            <ToggleGroupItem value="all">
              <LayoutGridIcon data-icon="inline-start" className="opacity-70" />
              Alle
            </ToggleGroupItem>
            <ToggleGroupItem value="untitled">
              <FilePenIcon data-icon="inline-start" className="opacity-70" />
              Unbenannt
            </ToggleGroupItem>
            <ToggleGroupItem value="last24h" title="Nur Clips der letzten 24 Stunden">
              <ClockIcon data-icon="inline-start" className="opacity-70" />
              24 Std.
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      {tags.length > 0 ? (
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          className="flex-wrap"
          value={untaggedOnly ? [UNTAGGED_FILTER] : activeTagIds}
          onValueChange={(values) => {
            if (values.includes(UNTAGGED_FILTER) && !untaggedOnly) {
              setUntaggedOnly(true);
              setTagFilterIds([]);
              return;
            }
            setUntaggedOnly(false);
            setTagFilterIds(values.filter((id) => id !== UNTAGGED_FILTER));
          }}
        >
          <ToggleGroupItem value={UNTAGGED_FILTER} title="Nur Clips ohne Tags">
            Ohne Tags
          </ToggleGroupItem>
          {tags.map((tag) => (
            <ToggleGroupItem key={tag.id} value={tag.id}>
              <TagsIcon data-icon="inline-start" className="opacity-70" />
              {tag.name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}
      {visible.length === 0 ? (
        <Empty className="glass border border-dashed border-white/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {clips.length === 0 ? <FilmIcon /> : <FileQuestionIcon />}
            </EmptyMedia>
            <EmptyTitle>
              {clips.length === 0
                ? "Noch keine Clips"
                : untaggedOnly
                  ? "Keine Clips ohne Tags"
                  : activeTagIds.length > 0
                    ? "Keine Clips mit diesen Tags"
                    : filter === "last24h"
                      ? "Keine Clips der letzten 24 Stunden"
                      : "Keine unbenannten Clips"}
            </EmptyTitle>
            <EmptyDescription>
              {clips.length === 0
                ? "Speichere einen Replay aus OBS oder drücke eine Clip-Schaltfläche."
                : untaggedOnly
                  ? "Jeder Clip in der Bibliothek hat mindestens ein Tag."
                  : activeTagIds.length > 0
                    ? "Kein Clip hat eines der ausgewählten Tags."
                    : filter === "last24h"
                      ? "Es gibt keine Clips aus den letzten 24 Stunden."
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
                tags={tags}
                selected={clip.id === selectedId}
                onSelect={onSelect}
                onOpen={onOpen}
                onRename={onRename}
                onReveal={onReveal}
                onDelete={(id) => setPendingDeleteId(id)}
                onCut={onCut}
                onSetTags={onSetTags}
                onCreateTag={onCreateTag}
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
