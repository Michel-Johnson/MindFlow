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
  Workflow
} from "lucide-react";
import { HelpDialog } from "./HelpDialog";
import { useRef, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { LayoutDirection } from "@/lib/layout";

interface SidebarProps {
  onExport: (type: 'png' | 'svg' | 'pdf' | 'json') => void;
  onLayout: (direction?: LayoutDirection) => void;
  onLoad: (file: File) => void;
  currentTheme: ThemeId;
  onThemeChange: (themeId: ThemeId) => void;
  onAddChild: () => void;
}

export function Sidebar({ onExport, onLayout, onLoad, currentTheme, onThemeChange, onAddChild }: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoad(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-64 h-full bg-card border-r flex flex-col z-20 shadow-xl transition-colors duration-300">
      <div className="p-4 border-b flex items-center justify-between bg-card">
        <div>
          <h1 className="font-bold text-xl flex items-center gap-2 text-foreground">
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
            <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
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
            <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
              <Palette className="w-3 h-3" />
              Themes
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {themes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => onThemeChange(theme.id)}
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
                  <span className="absolute bottom-1 left-1 text-[8px] font-medium text-foreground/80 bg-background/50 px-1 rounded backdrop-blur-sm">
                    {theme.name}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <Separator />

          <section>
            <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
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
            <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
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
      
      <div className="p-4 border-t bg-muted/20">
        <p className="text-[10px] text-muted-foreground text-center">
          Auto-saves every 2s • Right-click to Pan
        </p>
        <p className="text-[10px] text-muted-foreground text-center mt-1">
          Author: Michel-Johnson
        </p>
      </div>
    </div>
  );
}
