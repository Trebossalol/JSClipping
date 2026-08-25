import { useEffect, useRef, useState } from "react";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  clipPresetSeconds,
  type AppConfigDto,
  type ObsStatus,
} from "@shared/ipc";
import type { SettingsSection } from "../AppSidebar";
import { getClipAvailability } from "../ClipActions";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  LibraryIcon,
  type LucideIcon,
} from "lucide-react";
import { AutostartStep } from "./AutostartStep";
import { BufferStep } from "./BufferStep";
import { ClipStep } from "./ClipStep";
import { DoneStep } from "./DoneStep";
import { HideOnboardingDialog } from "./HideOnboardingDialog";
import { ObsStep } from "./ObsStep";
import { PresetsStep } from "./PresetsStep";
import { ONBOARDING_STEPS } from "./steps";
import { WelcomeStep } from "./WelcomeStep";

interface OnboardingPageProps {
  config: AppConfigDto;
  obsStatus: ObsStatus | null;
  busy: boolean;
  onCreateClip: (seconds: number) => void;
  onGoToLibrary: () => void;
  onGoToSettings: (section: SettingsSection) => void;
  onHide: () => Promise<void>;
}

export function OnboardingPage({
  config,
  obsStatus,
  busy,
  onCreateClip,
  onGoToLibrary,
  onGoToSettings,
  onHide,
}: OnboardingPageProps) {
  const [step, setStep] = useState(0);
  const [hideChecked, setHideChecked] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hiding, setHiding] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);
  const { connected, replayOff, canClip } = getClipAvailability(obsStatus, busy);
  const replayMax = connected ? (obsStatus?.replayMaxSeconds ?? null) : null;
  const presetSeconds = clipPresetSeconds(config.CLIP_PRESETS);
  const shortestPreset = presetSeconds[0] ?? 30;
  const overBuffer = replayMax != null && shortestPreset > replayMax;
  const setupReady = connected && !replayOff;
  const current = ONBOARDING_STEPS[step]!;
  const StepIcon: LucideIcon = current.icon;
  const isFirst = step === 0;
  const isLast = step === ONBOARDING_STEPS.length - 1;

  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
  }, [step]);

  function requestHide(checked: boolean): void {
    if (!checked) return;
    setHideChecked(true);
    setConfirmOpen(true);
  }

  function cancelHide(): void {
    if (hiding) return;
    setConfirmOpen(false);
    setHideChecked(false);
  }

  async function confirmHide(): Promise<void> {
    setHiding(true);
    try {
      await onHide();
    } catch (err) {
      setHiding(false);
      setHideChecked(false);
      setConfirmOpen(false);
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div ref={topRef} className="mx-auto flex w-full max-w-200 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Schritt {step + 1} von {ONBOARDING_STEPS.length}
        </p>
        <div className="flex gap-1">
          {ONBOARDING_STEPS.map((item, index) => (
            <button
              key={item.title}
              type="button"
              aria-label={`Schritt ${index + 1}: ${item.title}`}
              aria-current={index === step ? "step" : undefined}
              className={cn(
                "h-1 flex-1 rounded-full",
                index <= step ? "bg-primary" : "bg-muted",
              )}
              onClick={() => setStep(index)}
            />
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant="secondary" className="min-w-5 justify-center tabular-nums">
              {step + 1}
            </Badge>
            <StepIcon className="size-4" />
            {current.heading}
          </CardTitle>
          <CardDescription>{current.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {step === 0 ? (
            <WelcomeStep
              connected={connected}
              setupReady={setupReady}
              replayOff={replayOff}
              replayMax={replayMax}
              autostart={config.AUTOSTART}
            />
          ) : null}
          {step === 1 ? (
            <ObsStep connected={connected} onGoToSettings={onGoToSettings} />
          ) : null}
          {step === 2 ? (
            <BufferStep
              outputDir={config.CLIP_OUTPUT_DIR}
              onGoToSettings={onGoToSettings}
            />
          ) : null}
          {step === 3 ? (
            <AutostartStep onGoToSettings={onGoToSettings} />
          ) : null}
          {step === 4 ? (
            <PresetsStep
              presets={presetSeconds}
              replayMax={replayMax}
              onGoToSettings={onGoToSettings}
            />
          ) : null}
          {step === 5 ? (
            <ClipStep
              presets={presetSeconds}
              shortestPreset={shortestPreset}
              replayMax={replayMax}
              overBuffer={overBuffer}
              connected={connected}
              replayOff={replayOff}
              canClip={canClip}
              busy={busy}
              onCreateClip={onCreateClip}
            />
          ) : null}
          {step === 6 ? (
            <DoneStep
              hideChecked={hideChecked}
              hiding={hiding}
              onRequestHide={requestHide}
            />
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isFirst}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ChevronLeftIcon data-icon="inline-start" />
            Zurück
          </Button>
          {isLast ? (
            <Button type="button" onClick={onGoToLibrary}>
              <LibraryIcon data-icon="inline-start" />
              Zur Bibliothek
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() =>
                setStep((s) => Math.min(ONBOARDING_STEPS.length - 1, s + 1))
              }
            >
              Weiter
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          )}
        </CardFooter>
      </Card>

      <HideOnboardingDialog
        open={confirmOpen}
        hiding={hiding}
        onOpenChange={(open) => {
          if (!open) cancelHide();
        }}
        onConfirm={() => void confirmHide()}
      />
    </div>
  );
}
