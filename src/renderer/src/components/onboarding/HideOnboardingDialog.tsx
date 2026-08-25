import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface HideOnboardingDialogProps {
  open: boolean;
  hiding: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function HideOnboardingDialog({
  open,
  hiding,
  onOpenChange,
  onConfirm,
}: HideOnboardingDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Einrichtung ausblenden?</AlertDialogTitle>
          <AlertDialogDescription>
            Die Seite verschwindet aus dem Menü. Du kannst sie danach nicht mehr
            von dort öffnen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={hiding}>Abbrechen</AlertDialogCancel>
          <Button type="button" disabled={hiding} onClick={onConfirm}>
            {hiding ? <Spinner data-icon="inline-start" /> : null}
            Ausblenden
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
