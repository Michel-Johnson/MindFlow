import { Handle, Position, NodeProps } from '@xyflow/react';
import { useState, useRef, useEffect, memo, type ChangeEvent, type KeyboardEvent, type MouseEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

const preprocessContent = (text: string): string => {
  return text
    .replace(/___HIGHLIGHT_START___([\s\S]*?)___HIGHLIGHT_END___/g, '<mark>$1</mark>')
    .replace(/HIGHLIGHT_START___([\s\S]*?)___HIGHLIGHT_END/g, '<mark>$1</mark>')
    .replace(/___UNDERLINE_START___([\s\S]*?)___UNDERLINE_END___/g, '<u>$1</u>')
    .replace(/UNDERLINE_START___([\s\S]*?)___UNDERLINE_END/g, '<u>$1</u>')
    .replace(/==([^=]+)==/g, '<mark>$1</mark>');
};

interface CustomNodeData extends Record<string, unknown> {
  label: string;
  emoji?: string;
  width?: number;
  height?: number;
  onChange?: (id: string, label: string) => void;
  onEditStart?: (id: string) => void;
  onEditEnd?: (id: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
}

export const CustomNode = memo(({ data, selected, id, targetPosition, sourcePosition }: NodeProps) => {
  const nodeData = data as CustomNodeData;
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(nodeData.label);
  const [isResizing, setIsResizing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  const targetPos = targetPosition || Position.Left;
  const sourcePos = sourcePosition || Position.Right;

  useEffect(() => {
    setContent(nodeData.label);
  }, [nodeData.label]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    if (nodeData.onEditStart) {
      nodeData.onEditStart(id);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (nodeData.onChange) {
      nodeData.onChange(id, content);
    }
    if (nodeData.onEditEnd) {
      nodeData.onEditEnd(id);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleBlur();
    }
    e.stopPropagation();
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (isEditing || isResizing) {
      e.stopPropagation();
    }
  };

  const handleResizeMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = nodeRef.current?.offsetWidth || 200;
    const startHeight = nodeRef.current?.offsetHeight || 100;

    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
      const newWidth = Math.max(150, startWidth + (moveEvent.clientX - startX));
      const newHeight = Math.max(60, startHeight + (moveEvent.clientY - startY));
      
      if (nodeRef.current) {
        nodeRef.current.style.width = `${newWidth}px`;
        nodeRef.current.style.minHeight = `${newHeight}px`;
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      if (nodeData.onResize && nodeRef.current) {
        nodeData.onResize(id, nodeRef.current.offsetWidth, nodeRef.current.offsetHeight);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
      
      const textarea = textareaRef.current;
      const preventZoom = (e: WheelEvent) => {
        e.stopPropagation();
      };
      textarea.addEventListener('wheel', preventZoom, { capture: true });
      return () => {
        textarea.removeEventListener('wheel', preventZoom, { capture: true });
      };
    }
  }, [isEditing]);

  const nodeStyle: React.CSSProperties = {
    width: nodeData.width ? `${nodeData.width}px` : undefined,
    minHeight: nodeData.height ? `${nodeData.height}px` : undefined,
  };

  const getHandleClassName = (position: Position) => {
    const baseClass = "!bg-node-border !w-2 !h-2 !opacity-0 hover:!opacity-100 transition-opacity";
    switch (position) {
      case Position.Left:
        return `${baseClass} !-ml-1`;
      case Position.Right:
        return `${baseClass} !-mr-1`;
      case Position.Top:
        return `${baseClass} !-mt-1`;
      case Position.Bottom:
        return `${baseClass} !-mb-1`;
      default:
        return baseClass;
    }
  };

  return (
    <div
      ref={nodeRef}
      className={cn(
        "min-w-[150px] max-w-[600px] px-5 py-4 rounded-xl shadow-md transition-all duration-300 group relative",
        "bg-node-bg border-2 border-node-border",
        selected 
          ? "border-primary ring-4 ring-primary/10 shadow-xl scale-[1.02] z-50" 
          : "hover:border-primary/50 hover:shadow-lg z-10",
        "flex flex-col justify-center backdrop-blur-sm",
        isEditing && "nodrag cursor-text"
      )}
      style={nodeStyle}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      data-editing={isEditing}
      data-node-id={id}
    >
      <Handle 
        type="target" 
        position={targetPos} 
        className={getHandleClassName(targetPos)} 
      />
      
      {nodeData.emoji && (
        <div className="absolute -top-4 -left-3 bg-card border border-border rounded-full w-10 h-10 flex items-center justify-center shadow-md text-xl z-20 transition-transform hover:scale-110">
          {nodeData.emoji}
        </div>
      )}

      {isEditing ? (
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onWheel={handleWheel}
          className="w-full resize-none text-sm bg-transparent border-none focus-visible:ring-0 p-0 font-mono leading-relaxed text-foreground placeholder:text-muted-foreground overflow-y-auto"
          style={{ height: nodeData.height ? `${nodeData.height - 32}px` : '68px' }}
          placeholder="输入内容，支持 Markdown 格式..."
        />
      ) : (
        <div className="markdown-content text-foreground select-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeRaw, rehypeKatex]}
            components={{
              p: ({children, node}) => {
                const hasImg = node?.children?.some((child: any) => child.tagName === 'img');
                if (hasImg) {
                  return <>{children}</>;
                }
                return <p className="m-0 leading-relaxed text-sm font-medium">{children}</p>;
              },
              h1: ({children}) => <h1 className="text-xl font-bold border-b border-border/50 pb-2 mb-2 text-primary">{children}</h1>,
              h2: ({children}) => <h2 className="text-lg font-bold mb-1 text-foreground/90">{children}</h2>,
              h3: ({children}) => <h3 className="text-base font-bold mb-1 text-foreground/80">{children}</h3>,
              code: ({children}) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-primary border border-border/50">{children}</code>,
              li: ({children}) => <li className="text-sm my-0.5">{children}</li>,
              img: ({src, alt}) => {
                if (!src) return null;
                return (
                  <img 
                    src={src} 
                    alt={alt || ''} 
                    className="max-w-full h-auto rounded my-2 block" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                );
              },
              u: ({children}) => <u className="underline">{children}</u>,
              mark: ({children}) => <mark className="bg-yellow-200 px-0.5 rounded text-black">{children}</mark>
            }}
          >
            {preprocessContent(content || "*双击编辑*")}
          </ReactMarkdown>
        </div>
      )}
      
      <Handle 
        type="source" 
        position={sourcePos} 
        className={getHandleClassName(sourcePos)} 
      />
      
      <div 
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseDown={handleResizeMouseDown}
      >
        <svg viewBox="0 0 16 16" className="w-full h-full text-muted-foreground">
          <path d="M14 14H10M14 14V10M14 14L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      </div>
      
      {!isEditing && selected && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] bg-primary/90 text-primary-foreground px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap shadow-sm translate-y-2 group-hover:translate-y-0">
          双击编辑 • 拖动边角调整大小
        </div>
      )}
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
