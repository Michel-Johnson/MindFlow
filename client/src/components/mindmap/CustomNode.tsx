import { Handle, Position, NodeProps } from '@xyflow/react';
import { useState, useRef, useEffect, memo, type ChangeEvent, type KeyboardEvent, type MouseEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

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
  level?: number;
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
  nodeSize?: 'small' | 'medium' | 'large' | 'xlarge';
  onChange?: (id: string, label: string) => void;
  onEditStart?: (id: string) => void;
  onEditEnd?: (id: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onFontSizeChange?: (id: string, fontSize: 'small' | 'medium' | 'large' | 'xlarge') => void;
  onNodeSizeChange?: (id: string, nodeSize: 'small' | 'medium' | 'large' | 'xlarge') => void;
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
  
  // Get node level (default to 0 for root nodes)
  const level = nodeData.level ?? 0;
  const customFontSize = nodeData.fontSize;
  const customNodeSize = nodeData.nodeSize;
  
  // Define styles based on level and custom settings
  const getLevelStyles = () => {
    // Base styles by level
    let baseStyles;
    switch (level) {
      case 0: // 主节点
        baseStyles = {
          fontSize: 'text-2xl',
          fontWeight: 'font-bold',
          borderWidth: 'border-4',
          borderColor: 'border-primary',
          padding: 'px-6 py-5',
          minWidth: 'min-w-[200px]',
          shadow: 'shadow-xl',
          borderRadius: 'rounded-2xl'
        };
        break;
      case 1: // 次级节点
        baseStyles = {
          fontSize: 'text-base',
          fontWeight: 'font-semibold',
          borderWidth: 'border-[3px]',
          padding: 'px-5 py-4',
          minWidth: 'min-w-[180px]',
          shadow: 'shadow-lg',
          borderRadius: 'rounded-xl'
        };
        break;
      case 2: // 第三级节点
        baseStyles = {
          fontSize: 'text-sm',
          fontWeight: 'font-medium',
          borderWidth: 'border-2',
          padding: 'px-4 py-3',
          minWidth: 'min-w-[150px]',
          shadow: 'shadow-md',
          borderRadius: 'rounded-lg'
        };
        break;
      default: // 第四级及以下
        baseStyles = {
          fontSize: 'text-xs',
          fontWeight: 'font-normal',
          borderWidth: 'border-2',
          padding: 'px-3 py-2',
          minWidth: 'min-w-[120px]',
          shadow: 'shadow-sm',
          borderRadius: 'rounded-lg'
        };
    }
    
    // Override with custom fontSize
    if (customFontSize) {
      const fontSizeMap = {
        small: 'text-xs',
        medium: 'text-sm',
        large: 'text-base',
        xlarge: 'text-lg'
      };
      baseStyles.fontSize = fontSizeMap[customFontSize];
    }
    
    // Override with custom nodeSize
    if (customNodeSize) {
      const sizeMap = {
        small: {
          padding: 'px-3 py-2',
          minWidth: 'min-w-[120px]',
          borderWidth: 'border-2'
        },
        medium: {
          padding: 'px-4 py-3',
          minWidth: 'min-w-[150px]',
          borderWidth: 'border-2'
        },
        large: {
          padding: 'px-5 py-4',
          minWidth: 'min-w-[180px]',
          borderWidth: 'border-[3px]'
        },
        xlarge: {
          padding: 'px-6 py-5',
          minWidth: 'min-w-[200px]',
          borderWidth: 'border-4'
        }
      };
      Object.assign(baseStyles, sizeMap[customNodeSize]);
    }
    
    return baseStyles;
  };
  
  const levelStyles = getLevelStyles();

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
        nodeRef.current.style.height = `${newHeight}px`;
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
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={nodeRef}
          className={cn(
            "max-w-[600px] transition-all duration-300 group relative",
            levelStyles.minWidth,
            levelStyles.padding,
            levelStyles.borderRadius,
            levelStyles.shadow,
            "bg-node-bg",
            level === 0 ? levelStyles.borderColor : "border-node-border",
            levelStyles.borderWidth,
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
      {/* Multiple target handles to support connections from different directions */}
      <Handle 
        type="target" 
        position={Position.Left} 
        id="left"
        className={getHandleClassName(Position.Left)} 
      />
      <Handle 
        type="target" 
        position={Position.Right} 
        id="right"
        className={getHandleClassName(Position.Right)} 
      />
      <Handle 
        type="target" 
        position={Position.Top} 
        id="top"
        className={getHandleClassName(Position.Top)} 
      />
      <Handle 
        type="target" 
        position={Position.Bottom} 
        id="bottom"
        className={getHandleClassName(Position.Bottom)} 
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
          className={cn(
            "w-full resize-none bg-transparent border-none focus-visible:ring-0 p-0 font-mono leading-relaxed text-foreground placeholder:text-muted-foreground overflow-y-auto",
            levelStyles.fontSize,
            levelStyles.fontWeight
          )}
          style={{ height: nodeData.height ? `${nodeData.height - 32}px` : '68px' }}
          placeholder="输入内容，支持 Markdown 格式..."
        />
      ) : (
        <div className={cn("markdown-content text-foreground select-none break-words", levelStyles.fontSize)}>
          {(() => {
            // 手动处理图片：提取并单独渲染
            const text = preprocessContent(content || "*双击编辑*");
            const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
            const parts: React.ReactNode[] = [];
            let lastIndex = 0;
            let match;
            let key = 0;

            while ((match = imgRegex.exec(text)) !== null) {
              // 添加图片前的文本
              if (match.index > lastIndex) {
                const beforeText = text.substring(lastIndex, match.index);
                parts.push(
                  <ReactMarkdown
                    key={`text-${key++}`}
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex, rehypeRaw]}
                    components={{
                      p: ({children}) => <p className={cn("m-0 leading-relaxed", levelStyles.fontSize, levelStyles.fontWeight)}>{children}</p>,
                      h1: ({children}) => {
                        const h1Size = level === 0 ? 'text-2xl' : level === 1 ? 'text-xl' : level === 2 ? 'text-lg' : 'text-base';
                        return <h1 className={cn("font-bold border-b border-border/50 pb-2 mb-2 text-primary", h1Size)}>{children}</h1>;
                      },
                      h2: ({children}) => {
                        const h2Size = level === 0 ? 'text-xl' : level === 1 ? 'text-lg' : level === 2 ? 'text-base' : 'text-sm';
                        return <h2 className={cn("font-bold mb-1 text-foreground/90", h2Size)}>{children}</h2>;
                      },
                      h3: ({children}) => {
                        const h3Size = level === 0 ? 'text-lg' : level === 1 ? 'text-base' : level === 2 ? 'text-sm' : 'text-xs';
                        return <h3 className={cn("font-bold mb-1 text-foreground/80", h3Size)}>{children}</h3>;
                      },
                      code: ({children}) => {
                        const codeSize = level <= 1 ? 'text-xs' : 'text-[10px]';
                        return <code className={cn("bg-muted px-1.5 py-0.5 rounded font-mono text-primary border border-border/50", codeSize)}>{children}</code>;
                      },
                      li: ({children}) => <li className={cn("my-0.5", levelStyles.fontSize)}>{children}</li>,
                      u: ({children}) => <u className="underline">{children}</u>,
                      mark: ({children}) => <mark className="bg-yellow-200 px-0.5 rounded text-black">{children}</mark>
                    }}
                  >
                    {beforeText}
                  </ReactMarkdown>
                );
              }
              
              // 直接渲染图片（不通过markdown）
              const [, alt, src] = match;
              parts.push(
                <div key={`img-${key++}`} className="my-2 flex justify-center">
                  <img 
                    src={src} 
                    alt={alt || 'image'} 
                    className="max-w-full max-h-[200px] h-auto rounded object-contain"
                    loading="lazy"
                    onLoad={() => console.log('✓ Image loaded')}
                    onError={(e) => {
                      console.error('✗ Image load failed');
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBFcnJvcjwvdGV4dD48L3N2Zz4=';
                    }}
                  />
                </div>
              );
              
              lastIndex = match.index + match[0].length;
            }
            
            // 添加剩余文本
            if (lastIndex < text.length) {
              const remainingText = text.substring(lastIndex);
              parts.push(
                <ReactMarkdown
                  key={`text-${key++}`}
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex, rehypeRaw]}
                  components={{
                    p: ({children}) => <p className={cn("m-0 leading-relaxed", levelStyles.fontSize, levelStyles.fontWeight)}>{children}</p>,
                    h1: ({children}) => {
                      const h1Size = level === 0 ? 'text-2xl' : level === 1 ? 'text-xl' : level === 2 ? 'text-lg' : 'text-base';
                      return <h1 className={cn("font-bold border-b border-border/50 pb-2 mb-2 text-primary", h1Size)}>{children}</h1>;
                    },
                    h2: ({children}) => {
                      const h2Size = level === 0 ? 'text-xl' : level === 1 ? 'text-lg' : level === 2 ? 'text-base' : 'text-sm';
                      return <h2 className={cn("font-bold mb-1 text-foreground/90", h2Size)}>{children}</h2>;
                    },
                    h3: ({children}) => {
                      const h3Size = level === 0 ? 'text-lg' : level === 1 ? 'text-base' : level === 2 ? 'text-sm' : 'text-xs';
                      return <h3 className={cn("font-bold mb-1 text-foreground/80", h3Size)}>{children}</h3>;
                    },
                    code: ({children}) => {
                      const codeSize = level <= 1 ? 'text-xs' : 'text-[10px]';
                      return <code className={cn("bg-muted px-1.5 py-0.5 rounded font-mono text-primary border border-border/50", codeSize)}>{children}</code>;
                    },
                    li: ({children}) => <li className={cn("my-0.5", levelStyles.fontSize)}>{children}</li>,
                    u: ({children}) => <u className="underline">{children}</u>,
                    mark: ({children}) => <mark className="bg-yellow-200 px-0.5 rounded text-black">{children}</mark>
                  }}
                >
                  {remainingText}
                </ReactMarkdown>
              );
            }
            
            return parts.length > 0 ? parts : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeRaw]}
                components={{
                  p: ({children}) => <p className={cn("m-0 leading-relaxed", levelStyles.fontSize, levelStyles.fontWeight)}>{children}</p>,
                  h1: ({children}) => {
                    const h1Size = level === 0 ? 'text-2xl' : level === 1 ? 'text-xl' : level === 2 ? 'text-lg' : 'text-base';
                    return <h1 className={cn("font-bold border-b border-border/50 pb-2 mb-2 text-primary", h1Size)}>{children}</h1>;
                  },
                  h2: ({children}) => {
                    const h2Size = level === 0 ? 'text-xl' : level === 1 ? 'text-lg' : level === 2 ? 'text-base' : 'text-sm';
                    return <h2 className={cn("font-bold mb-1 text-foreground/90", h2Size)}>{children}</h2>;
                  },
                  h3: ({children}) => {
                    const h3Size = level === 0 ? 'text-lg' : level === 1 ? 'text-base' : level === 2 ? 'text-sm' : 'text-xs';
                    return <h3 className={cn("font-bold mb-1 text-foreground/80", h3Size)}>{children}</h3>;
                  },
                  code: ({children}) => {
                    const codeSize = level <= 1 ? 'text-xs' : 'text-[10px]';
                    return <code className={cn("bg-muted px-1.5 py-0.5 rounded font-mono text-primary border border-border/50", codeSize)}>{children}</code>;
                  },
                  li: ({children}) => <li className={cn("my-0.5", levelStyles.fontSize)}>{children}</li>,
                  u: ({children}) => <u className="underline">{children}</u>,
                  mark: ({children}) => <mark className="bg-yellow-200 px-0.5 rounded text-black">{children}</mark>
                }}
              >
                {text}
              </ReactMarkdown>
            );
          })()}
        </div>
      )}
      
          {/* Multiple source handles to support both left and right children (horizontal) */}
          <Handle 
            type="source" 
            position={Position.Right} 
            id="right"
            className={getHandleClassName(Position.Right)} 
          />
          <Handle 
            type="source" 
            position={Position.Left} 
            id="left"
            className={getHandleClassName(Position.Left)} 
          />
          {/* Multiple source handles to support both top and bottom children (vertical) */}
          <Handle 
            type="source" 
            position={Position.Top} 
            id="top"
            className={getHandleClassName(Position.Top)} 
          />
          <Handle 
            type="source" 
            position={Position.Bottom} 
            id="bottom"
            className={getHandleClassName(Position.Bottom)} 
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
              双击编辑 • 拖动边角调整大小 • 右键菜单
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>字体大小</ContextMenuLabel>
        <ContextMenuItem onClick={() => nodeData.onFontSizeChange?.(id, 'small')}>
          <span className="flex items-center justify-between w-full">
            <span>小</span>
            {customFontSize === 'small' && <span className="ml-2">✓</span>}
          </span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => nodeData.onFontSizeChange?.(id, 'medium')}>
          <span className="flex items-center justify-between w-full">
            <span>中</span>
            {customFontSize === 'medium' && <span className="ml-2">✓</span>}
          </span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => nodeData.onFontSizeChange?.(id, 'large')}>
          <span className="flex items-center justify-between w-full">
            <span>大</span>
            {customFontSize === 'large' && <span className="ml-2">✓</span>}
          </span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => nodeData.onFontSizeChange?.(id, 'xlarge')}>
          <span className="flex items-center justify-between w-full">
            <span>特大</span>
            {customFontSize === 'xlarge' && <span className="ml-2">✓</span>}
          </span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuLabel>节点大小</ContextMenuLabel>
        <ContextMenuItem onClick={() => nodeData.onNodeSizeChange?.(id, 'small')}>
          <span className="flex items-center justify-between w-full">
            <span>小</span>
            {customNodeSize === 'small' && <span className="ml-2">✓</span>}
          </span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => nodeData.onNodeSizeChange?.(id, 'medium')}>
          <span className="flex items-center justify-between w-full">
            <span>中</span>
            {customNodeSize === 'medium' && <span className="ml-2">✓</span>}
          </span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => nodeData.onNodeSizeChange?.(id, 'large')}>
          <span className="flex items-center justify-between w-full">
            <span>大</span>
            {customNodeSize === 'large' && <span className="ml-2">✓</span>}
          </span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => nodeData.onNodeSizeChange?.(id, 'xlarge')}>
          <span className="flex items-center justify-between w-full">
            <span>特大</span>
            {customNodeSize === 'xlarge' && <span className="ml-2">✓</span>}
          </span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
});

CustomNode.displayName = 'CustomNode';
