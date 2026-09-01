import { useEffect, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PlusIcon, TagsIcon, Trash2Icon } from "lucide-react";
import type { ClipRecord, TagRecord } from "@shared/ipc";
import {
  clipTagIds,
  MAX_TAG_NAME_LENGTH,
  normalizeTagName,
} from "@shared/tags/names";

interface TagsSectionProps {
  tags: TagRecord[];
  clips: ClipRecord[];
}

function usageLabel(count: number): string {
  return count === 1 ? "1 Clip" : `${count} Clips`;
}

interface TagRowProps {
  tag: TagRecord;
  usage: number;
  onRename: (id: string, name: string) => Promise<boolean>;
  onAskDelete: (tag: TagRecord) => void;
}

function TagRow({ tag, usage, onRename, onAskDelete }: TagRowProps) {
  const [name, setName] = useState(tag.name);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(tag.name);
  }, [tag.name]);

  async function commit(): Promise<void> {
    const next = normalizeTagName(name);
    if (!next || next === tag.name || saving) {
      setName(tag.name);
      return;
    }
    setSaving(true);
    try {
      const ok = await onRename(tag.id, next);
      if (!ok) setName(tag.name);
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === "Escape") {
      setName(tag.name);
      (e.target as HTMLInputElement).blur();
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={name}
        maxLength={MAX_TAG_NAME_LENGTH}
        disabled={saving}
        aria-label={`Tag ${tag.name} umbenennen`}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={onKeyDown}
      />
      <Badge variant="secondary" className="shrink-0">
        {usageLabel(usage)}
      </Badge>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="shrink-0 text-muted-foreground"
        aria-label={`Tag ${tag.name} löschen`}
        onClick={() => onAskDelete(tag)}
      >
        <Trash2Icon className="opacity-70" />
      </Button>
    </div>
  );
}

export function TagsSection({ tags, clips }: TagsSectionProps) {
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TagRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleCreate(): Promise<void> {
    const name = normalizeTagName(draft);
    if (!name || creating) return;
    setCreating(true);
    try {
      const result = await window.api.createTag(name);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDraft("");
      toast.success(`Tag „${result.tag.name}“ angelegt.`);
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(id: string, name: string): Promise<boolean> {
    const result = await window.api.renameTag(id, name);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success("Tag umbenannt.");
    return true;
  }

  async function confirmDelete(): Promise<void> {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      const result = await window.api.deleteTag(pendingDelete.id);
      if (!result.ok) {
        toast.error(result.error ?? "Tag konnte nicht gelöscht werden.");
        return;
      }
      toast.success(`Tag „${pendingDelete.name}“ gelöscht.`);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  const pendingUsage = pendingDelete
    ? clips.filter((clip) => clipTagIds(clip).includes(pendingDelete.id)).length
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <TagsIcon className="size-4 text-primary opacity-80" />
            Tags
          </CardTitle>
          <CardDescription>
            Tags bleiben am Clip, auch wenn du ihn umbenennst. Sie ändern den
            Speicherort der Datei nicht.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-tag-name">Neues Tag</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="new-tag-name"
                    value={draft}
                    maxLength={MAX_TAG_NAME_LENGTH}
                    autoComplete="off"
                    disabled={creating}
                    placeholder="z. B. Highlight"
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleCreate();
                      }
                    }}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      type="button"
                      size="xs"
                      disabled={creating || !normalizeTagName(draft)}
                      onClick={() => void handleCreate()}
                    >
                      <PlusIcon data-icon="inline-start" />
                      Anlegen
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription>
                  Du kannst Tags auch direkt an einem Clip in der Bibliothek
                  anlegen und zuweisen.
                </FieldDescription>
              </Field>
            </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vorhandene Tags</CardTitle>
          <CardDescription>
            Umbenennen übernimmt den Namen in der Bibliothek. Löschen entfernt
            das Tag von allen Clips.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <Empty className="border border-dashed border-white/10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <TagsIcon />
                </EmptyMedia>
                <EmptyTitle>Noch keine Tags</EmptyTitle>
                <EmptyDescription>
                  Lege oben ein Tag an oder weise eines in der Bibliothek zu.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-2">
              {tags.map((tag) => (
                <TagRow
                  key={tag.id}
                  tag={tag}
                  usage={
                    clips.filter((clip) => clipTagIds(clip).includes(tag.id))
                      .length
                  }
                  onRename={handleRename}
                  onAskDelete={setPendingDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? pendingUsage > 0
                  ? `„${pendingDelete.name}“ wird von ${usageLabel(pendingUsage)} entfernt und aus der Liste gelöscht.`
                  : `„${pendingDelete.name}“ wird gelöscht. Kein Clip verwendet dieses Tag.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              <Trash2Icon data-icon="inline-start" />
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
