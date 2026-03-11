import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { themes, ThemeId } from "@/lib/themes";
import {
  Download, 
  FileJson, 
  Image as ImageIcon, 
  FileType, 
  MousePointer2,
  Layout,
  Upload,
  Save,
  Palette,
  Check,
  Plus,
  Network,
  GitGraph,
  Share2,
  Workflow,
  Settings,
  Trash2
} from "lucide-react";
import { HelpDialog } from "./HelpDialog";
import { useRef, useState, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { LayoutDirection } from "@/lib/layout";
import type { CustomThemeSettings } from "@/lib/customTheme";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SidebarProps {
  onExport: (type: 'png' | 'svg' | 'pdf' | 'json') => void;
  onLayout: (direction?: LayoutDirection) => void;
  onLoad: (file: File) => void;
  currentTheme: ThemeId;
  onThemeChange: (themeId: ThemeId) => void;
  onAddChild: () => void;
  customThemeSettings: CustomThemeSettings;
  customBackgroundUrl: string | null;
  onCustomBackgroundChange: (file: File) => void;
  onCustomBackgroundClear: () => void;
  onCustomThemeSettingsChange: (patch: Partial<CustomThemeSettings>) => void;
  onCustomThemeReset: () => void;
}

export function Sidebar({
  onExport,
  onLayout,
  onLoad,
  currentTheme,
  onThemeChange,
  onAddChild,
  customThemeSettings,
  customBackgroundUrl,
  onCustomBackgroundChange,
  onCustomBackgroundClear,
  onCustomThemeSettingsChange,
  onCustomThemeReset,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isForest = currentTheme === "forest";
  const isCustom = currentTheme === "custom";
  const isPhotoSidebar = isForest || isCustom;
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const customBgInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoad(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openCustomDialog = () => setCustomDialogOpen(true);

  const handleThemeClick = (themeId: ThemeId) => {
    onThemeChange(themeId);
    if (themeId === "custom") {
      openCustomDialog();
    }
  };

  const percent = (value01: number) => Math.round(value01 * 100);
  const setAlpha = (key: keyof CustomThemeSettings, pct: number) =>
    onCustomThemeSettingsChange({
      [key]: Math.max(0, Math.min(1, pct / 100)),
    } as Partial<CustomThemeSettings>);

  const handleCustomBgFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onCustomBackgroundChange(file);
    }
    if (customBgInputRef.current) {
      customBgInputRef.current.value = "";
    }
  };

  return (
    <div
      className={cn(
        "relative w-64 h-full flex flex-col z-20 transition-colors duration-300 shadow-xl",
        // Keep the edge soft (avoid a hard border line).
        "ring-1 ring-black/5 dark:ring-white/10",
        "bg-[rgb(var(--sidebar-bg-rgb)/var(--sidebar-bg-alpha))] backdrop-blur-lg backdrop-saturate-150",
        isPhotoSidebar && "text-white",
      )}
    >
      <div
        className={cn(
          "p-4 border-b flex items-center justify-between bg-transparent",
          isPhotoSidebar ? "border-white/15" : "border-border",
        )}
      >
        <div>
          <h1
            className={cn(
              "font-bold text-xl flex items-center gap-2",
              isPhotoSidebar ? "text-white" : "text-foreground",
            )}
          >
            <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-mono text-lg shadow-sm">M</span>
            MindFlow
          </h1>
        </div>
        <HelpDialog />
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          <section>
            <div className="grid gap-2">
              <Button size="sm" className="w-full" onClick={onAddChild}>
                <Plus className="w-4 h-4 mr-2" />
                Add Node (Tab)
              </Button>
            </div>
          </section>

          <section>
            <h3
              className={cn(
                "text-xs font-semibold mb-3 uppercase tracking-wider flex items-center gap-2",
                isPhotoSidebar ? "text-white/70" : "text-muted-foreground",
              )}
            >
              <Workflow className="w-3 h-3" />
              Layouts
            </h3>
            <div className="grid grid-cols-2 gap-2">
               <Button variant="outline" size="sm" className="justify-start text-xs" onClick={() => onLayout('LR')}>
                <Network className="w-3 h-3 mr-2" />
                Horizontal
              </Button>
              <Button variant="outline" size="sm" className="justify-start text-xs" onClick={() => onLayout('TB')}>
                <GitGraph className="w-3 h-3 mr-2 rotate-180" />
                Vertical
              </Button>
              <Button variant="outline" size="sm" className="justify-start text-xs" onClick={() => onLayout('radial')}>
                <Share2 className="w-3 h-3 mr-2" />
                Radial
              </Button>
              <Button variant="outline" size="sm" className="justify-start text-xs" onClick={() => onLayout('LR')}>
                <Layout className="w-3 h-3 mr-2" />
                Auto
              </Button>
            </div>
          </section>
          
          <section>
            <h3
              className={cn(
                "text-xs font-semibold mb-3 uppercase tracking-wider flex items-center gap-2",
                isPhotoSidebar ? "text-white/70" : "text-muted-foreground",
              )}
            >
              <Palette className="w-3 h-3" />
              Themes
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => handleThemeClick(theme.id)}
                  className={cn(
                    "relative h-16 rounded-lg border-2 transition-all overflow-hidden group",
                    currentTheme === theme.id 
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div 
                    className="absolute inset-0 flex flex-col"
                    style={{ backgroundColor: `hsl(${theme.colors.canvasBg})` }}
                  >
                    <div 
                      className="h-1/2 w-full flex items-center justify-center"
                      style={{ backgroundColor: `hsl(${theme.colors.nodeBg})`, borderBottom: `1px solid hsl(${theme.colors.nodeBorder})` }}
                    >
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: `hsl(${theme.colors.primary})` }}
                      />
                    </div>
                  </div>
                  {currentTheme === theme.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 dark:bg-white/10 backdrop-blur-[1px]">
                      <div className="bg-primary text-primary-foreground rounded-full p-0.5">
                        <Check className="w-3 h-3" />
                      </div>
                    </div>
                  )}
                  <span
                    className={cn(
                      "absolute bottom-1 left-1 text-[8px] font-medium px-1 rounded backdrop-blur-sm",
                      isPhotoSidebar
                        ? "text-white/80 bg-black/35"
                        : "text-foreground/80 bg-background/50",
                    )}
                  >
                    {theme.name}
                  </span>
                </button>
              ))}
            </div>

            {currentTheme === "custom" && (
              <div className="mt-2">
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={openCustomDialog}>
                  <Settings className="w-4 h-4 mr-2" />
                  Customize…
                </Button>
              </div>
            )}
          </section>

          <Separator />

          <section>
            <h3
              className={cn(
                "text-xs font-semibold mb-3 uppercase tracking-wider",
                isPhotoSidebar ? "text-white/70" : "text-muted-foreground",
              )}
            >
              Project
            </h3>
            <div className="grid gap-2">
              <Button variant="outline" size="sm" className="justify-start w-full" onClick={() => onExport('json')}>
                <Save className="w-4 h-4 mr-2" />
                Save Project
              </Button>
              <Button variant="outline" size="sm" className="justify-start w-full" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" />
                Load Project
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".json" 
                onChange={handleFileChange}
              />
            </div>
          </section>

          <Separator />

          <section>
            <h3
              className={cn(
                "text-xs font-semibold mb-3 uppercase tracking-wider",
                isPhotoSidebar ? "text-white/70" : "text-muted-foreground",
              )}
            >
              Export As
            </h3>
            <div className="grid gap-2">
              <Button variant="ghost" size="sm" className="justify-start w-full hover:bg-accent" onClick={() => onExport('png')}>
                <ImageIcon className="w-4 h-4 mr-2" />
                PNG Image
              </Button>
              <Button variant="ghost" size="sm" className="justify-start w-full hover:bg-accent" onClick={() => onExport('svg')}>
                <FileType className="w-4 h-4 mr-2" />
                SVG Vector
              </Button>
              <Button variant="ghost" size="sm" className="justify-start w-full hover:bg-accent" onClick={() => onExport('pdf')}>
                <FileType className="w-4 h-4 mr-2" />
                PDF Document
              </Button>
            </div>
          </section>
        </div>
      </ScrollArea>
      
      <div className={cn("p-4 border-t bg-transparent", isPhotoSidebar ? "border-white/15" : "border-border")}>
        <p className={cn("text-[10px] text-center", isPhotoSidebar ? "text-white/60" : "text-muted-foreground")}>
          Auto-saves every 2s • Right-click to Pan
        </p>
        <p className={cn("text-[10px] text-center mt-1", isPhotoSidebar ? "text-white/60" : "text-muted-foreground")}>
          Author: Michel-Johnson
        </p>
      </div>

      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Custom Theme</DialogTitle>
            <DialogDescription>
              Choose a background image and tune transparency for each module.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Background image</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => customBgInputRef.current?.click()}>
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Choose
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCustomBackgroundClear}
                    disabled={!customBackgroundUrl}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear
                  </Button>
                  <input
                    type="file"
                    ref={customBgInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleCustomBgFileChange}
                  />
                </div>
              </div>
              {customBackgroundUrl ? (
                <div className="w-full h-32 rounded-md overflow-hidden border">
                  <img
                    src={customBackgroundUrl}
                    alt="Custom background preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No image selected.</div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Background veil</div>
                <div className="text-xs text-muted-foreground">
                  {percent(customThemeSettings.backgroundOverlayAlpha)}%
                </div>
              </div>
              <Slider
                value={[percent(customThemeSettings.backgroundOverlayAlpha)]}
                min={0}
                max={80}
                step={1}
                onValueChange={(v) => setAlpha("backgroundOverlayAlpha", v[0] ?? 0)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Sidebar opacity</div>
                <div className="text-xs text-muted-foreground">
                  {percent(customThemeSettings.sidebarAlpha)}%
                </div>
              </div>
              <Slider
                value={[percent(customThemeSettings.sidebarAlpha)]}
                min={0}
                max={60}
                step={1}
                onValueChange={(v) => setAlpha("sidebarAlpha", v[0] ?? 0)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Toolbar opacity</div>
                <div className="text-xs text-muted-foreground">
                  {percent(customThemeSettings.toolbarAlpha)}%
                </div>
              </div>
              <Slider
                value={[percent(customThemeSettings.toolbarAlpha)]}
                min={0}
                max={95}
                step={1}
                onValueChange={(v) => setAlpha("toolbarAlpha", v[0] ?? 0)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Node opacity</div>
                <div className="text-xs text-muted-foreground">
                  {percent(customThemeSettings.nodeAlpha)}%
                </div>
              </div>
              <Slider
                value={[percent(customThemeSettings.nodeAlpha)]}
                min={40}
                max={100}
                step={1}
                onValueChange={(v) => setAlpha("nodeAlpha", v[0] ?? 100)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={onCustomThemeReset}>
                Reset defaults
              </Button>
              <Button onClick={() => setCustomDialogOpen(false)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
