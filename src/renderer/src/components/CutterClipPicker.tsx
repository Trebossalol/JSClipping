import { FilmIcon } from "lucide-react";
import type { ClipRecord } from "@shared/ipc";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDuration } from "../format";

interface CutterClipPickerProps {
  open: boolean;
  clips: ClipRecord[];
  openTabIds: string[];
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
}

export function CutterClipPicker({
  open,
  clips,
  openTabIds,
  onOpenChange,
  onSelect,
}: CutterClipPickerProps) {
  const openTabs = new Set(openTabIds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Clip auswählen</DialogTitle>
          <DialogDescription>
            Der Clip wird in einem neuen Tab geöffnet.
          </DialogDescription>
        </DialogHeader>
        <Command className="rounded-none bg-transparent">
          <CommandInput placeholder="Clip suchen…" />
          <CommandList>
            <CommandEmpty>Kein Clip gefunden.</CommandEmpty>
            <CommandGroup>
              {clips.map((clip) => {
                const duration = formatDuration(clip.durationSeconds);
                return (
                  <CommandItem
                    key={clip.id}
                    value={`${clip.name} ${clip.id}`}
                    data-checked={openTabs.has(clip.id)}
                    onSelect={() => onSelect(clip.id)}
                  >
                    {clip.thumbnailPath ? (
                      <img
                        src={clip.thumbnailPath}
                        alt=""
                        className="size-8 rounded-md object-cover"
                      />
                    ) : (
                      <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <FilmIcon />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{clip.name}</span>
                    {duration ? (
                      <span className="text-xs text-muted-foreground">
                        {duration}
                      </span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
