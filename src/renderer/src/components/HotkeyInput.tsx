import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import {
  acceleratorFromKeyboardEvent,
  formatHotkey,
} from "@shared/hotkeys";
import { KeyboardIcon, XIcon } from "lucide-react";

interface HotkeyInputProps {
  id: string;
  value: string | null;
  invalid?: boolean;
  className?: string;
  onChange: (value: string | null) => void;
}

export function HotkeyInput({
  id,
  value,
  invalid = false,
  className,
  onChange,
}: HotkeyInputProps) {
  const [recording, setRecording] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!recording) return;
    inputRef.current?.focus();
  }, [recording]);

  function stopRecording(): void {
    setRecording(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      stopRecording();
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      if (!event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
        onChange(null);
        stopRecording();
      }
      return;
    }
    const accelerator = acceleratorFromKeyboardEvent(event.nativeEvent);
    if (!accelerator) return;
    onChange(accelerator);
    stopRecording();
  }

  const display = recording
    ? "Taste drücken…"
    : value
      ? formatHotkey(value)
      : "";

  return (
    <InputGroup className={cn("w-44", className)}>
      <InputGroupAddon>
        <KeyboardIcon />
      </InputGroupAddon>
      <InputGroupInput
        ref={inputRef}
        id={id}
        readOnly
        autoComplete="off"
        aria-label="Tastenkürzel"
        aria-invalid={invalid}
        aria-pressed={recording}
        placeholder="Keine Taste"
        value={display}
        onFocus={() => setRecording(true)}
        onBlur={stopRecording}
        onKeyDown={handleKeyDown}
      />
      {value ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            size="icon-xs"
            aria-label="Tastenkürzel entfernen"
            onClick={() => {
              onChange(null);
              stopRecording();
            }}
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
}
