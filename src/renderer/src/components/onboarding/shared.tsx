import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { SettingsSection } from "../AppSidebar";
import { ChevronRightIcon, CircleCheckIcon, CircleIcon } from "lucide-react";

export type GoToSettings = (section: SettingsSection) => void;

export function SettingsLink({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button type="button" variant="outline" onClick={onClick}>
      {children}
      <ChevronRightIcon data-icon="inline-end" />
    </Button>
  );
}

export function CheckRow({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  const Icon = ok ? CircleCheckIcon : CircleIcon;
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{detail}</span>
      </div>
    </div>
  );
}

export function Trouble({ symptom, fix }: { symptom: string; fix: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium">{symptom}</span>
      <span className="text-muted-foreground">{fix}</span>
    </div>
  );
}
