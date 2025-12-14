import { Button } from "@/components/ui/button";
import { 
  Bold, 
  Italic, 
  Code, 
  Link, 
  Image as ImageIcon, 
  Smile, 
  Sigma, 
  List, 
  ListOrdered,
  Heading1,
  Underline,
  Highlighter
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { emojis } from "@/lib/emojis";
import { useRef, type ChangeEvent } from "react";

interface ToolbarProps {
  onFormat: (format: string, selectedText?: string) => void;
  onImageUpload: (file: File) => void;
  disabled?: boolean;
}

export function Toolbar({ onFormat, onImageUpload, disabled }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tools = [
    { icon: Bold, label: "加粗 (**text**)", format: "**text**" },
    { icon: Italic, label: "斜体 (*text*)", format: "*text*" },
    { icon: Underline, label: "下划线 (<u>text</u>)", format: "<u>text</u>" },
    { icon: Highlighter, label: "高亮 (==text==)", format: "==text==" },
    { icon: Heading1, label: "标题 (# text)", format: "# text" },
    { icon: Code, label: "行内代码 (`text`)", format: "`text`" },
    { icon: Sigma, label: "数学公式 ($x$)", format: "$x^2$" },
    { icon: List, label: "无序列表", format: "- item" },
    { icon: ListOrdered, label: "有序列表", format: "1. item" },
    { icon: Link, label: "链接", format: "[title](url)" },
  ];

  const handleFormatClick = (format: string) => {
    // Try to get selected text from active textarea
    const selection = window.getSelection();
    const selectedText = selection?.toString() || '';
    onFormat(format, selectedText);
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-background/80 backdrop-blur-sm border rounded-lg shadow-sm">
      {tools.map((tool, index) => (
        <Tooltip key={index}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleFormatClick(tool.format)}
              disabled={disabled}
            >
              <tool.icon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>{tool.label}</p>
          </TooltipContent>
        </Tooltip>
      ))}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-accent hover:text-accent-foreground"
            onClick={handleImageClick}
            disabled={disabled}
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Insert Image</p>
        </TooltipContent>
      </Tooltip>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleFileChange} 
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-accent hover:text-accent-foreground"
            disabled={disabled}
          >
            <Smile className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" side="top">
          <ScrollArea className="h-64 p-4">
            <div className="grid grid-cols-8 gap-1">
              {emojis.map((emoji, index) => (
                <button
                  key={index}
                  className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded text-lg"
                  onClick={() => handleFormatClick(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
