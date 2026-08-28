import { useEffect, useState } from "react";
import { APP_NAME } from "@shared/app.config";
import {
  ChevronRightIcon,
  FilePenIcon,
  LibraryIcon,
  ScissorsIcon,
  SettingsIcon,
} from "lucide-react";
import logoUrl from "../../../../resources/logo.svg";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export const SETTINGS_SECTIONS = [
  { id: "obs", title: "OBS Verbindung" },
  { id: "storage", title: "Speicher" },
  { id: "presets", title: "Presets" },
  { id: "autostart", title: "Autostart" },
  { id: "about", title: "Über" },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];
export type AppView = "library" | SettingsSection;

interface AppSidebarProps {
  view: AppView;
  onViewChange: (view: AppView) => void;
  untitledCount: number;
  onUntitled: () => void;
  onOpenCutter: () => void;
}

export function AppSidebar({
  view,
  onViewChange,
  untitledCount,
  onUntitled,
  onOpenCutter,
}: AppSidebarProps) {
  const settingsActive = view !== "library";
  const [settingsOpen, setSettingsOpen] = useState(settingsActive);

  useEffect(() => {
    if (settingsActive) setSettingsOpen(true);
  }, [settingsActive]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={APP_NAME}>
              <img
                src={logoUrl}
                alt=""
                className="size-8 rounded-lg"
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-bold">{APP_NAME}</span>
                <span className="truncate text-xs">OBS Clipping Software</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={view === "library"}
                  tooltip="Bibliothek"
                  onClick={() => onViewChange("library")}
                >
                  <LibraryIcon />
                  <span>Bibliothek</span>
                </SidebarMenuButton>
                {untitledCount > 0 ? (
                  <SidebarMenuBadge>{untitledCount}</SidebarMenuBadge>
                ) : null}
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Schneiden"
                  onClick={onOpenCutter}
                >
                  <ScissorsIcon />
                  <span>Schneiden</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <Collapsible
                asChild
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Einstellungen">
                      <SettingsIcon />
                      <span>Einstellungen</span>
                      <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {SETTINGS_SECTIONS.map((item) => (
                        <SidebarMenuSubItem key={item.id}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={view === item.id}
                          >
                            <button
                              type="button"
                              onClick={() => onViewChange(item.id)}
                            >
                              <span>{item.title}</span>
                            </button>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              {untitledCount > 0 && view !== "library" ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={`${untitledCount} unbenannt`}
                    onClick={onUntitled}
                  >
                    <FilePenIcon />
                    <span>{untitledCount} unbenannt</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
