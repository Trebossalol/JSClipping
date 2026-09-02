import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PlusIcon, TagsIcon } from "lucide-react";
import type { TagRecord } from "@shared/ipc";
import {
  MAX_TAG_NAME_LENGTH,
  normalizeTagName,
} from "@shared/tags/names";

interface ClipTagPickerProps {
  assignedIds: string[];
  tags: TagRecord[];
  onSetTags: (tagIds: string[]) => void | Promise<void>;
  onCreateTag: (name: string) => Promise<TagRecord | null>;
}

export function ClipTagPicker({
  assignedIds,
  tags,
  onSetTags,
  onCreateTag,
}: ClipTagPickerProps) {
  const assigned = new Set(assignedIds);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function toggle(tagId: string): Promise<void> {
    const next = assigned.has(tagId)
      ? assignedIds.filter((id) => id !== tagId)
      : [...assignedIds, tagId];
    await onSetTags(next);
  }

  async function create(e: FormEvent): Promise<void> {
    e.preventDefault();
    const name = normalizeTagName(draft);
    if (!name || busy) return;

    const existing = tags.find(
      (tag) => tag.name.toLowerCase() === name.toLowerCase(),
    );
    setBusy(true);
    try {
      if (existing) {
        if (!assigned.has(existing.id)) {
          await onSetTags([...assignedIds, existing.id]);
        }
        setDraft("");
        return;
      }
      const created = await onCreateTag(name);
      if (!created) return;
      setDraft("");
      await onSetTags([...assignedIds, created.id]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="shrink-0 text-muted-foreground"
          aria-label="Tags zuweisen"
          title="Tags zuweisen"
        >
          <TagsIcon className="opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 min-w-64 overflow-hidden p-0"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Command className="rounded-none bg-transparent">
          <CommandInput placeholder="Tag suchen…" />
          <CommandList className="max-h-52">
            {tags.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                Noch keine Tags. Lege unten eins an.
              </p>
            ) : (
              <>
                <CommandEmpty>Kein Tag gefunden.</CommandEmpty>
                <CommandGroup>
                  {tags.map((tag) => (
                    <CommandItem
                      key={tag.id}
                      value={tag.name}
                      data-checked={assigned.has(tag.id)}
                      onSelect={() => {
                        void toggle(tag.id);
                      }}
                    >
                      {tag.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
        <form
          className="flex items-center gap-1 border-t p-1.5"
          onSubmit={(e) => void create(e)}
        >
          <Input
            value={draft}
            maxLength={MAX_TAG_NAME_LENGTH}
            placeholder="Neues Tag…"
            disabled={busy}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <Button
            type="submit"
            size="icon-sm"
            variant="secondary"
            disabled={busy || !normalizeTagName(draft)}
            aria-label="Tag anlegen und zuweisen"
          >
            <PlusIcon />
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
