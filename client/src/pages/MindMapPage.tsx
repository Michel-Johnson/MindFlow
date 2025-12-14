import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  ReactFlow, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  BackgroundVariant,
  ConnectionLineType,
  SelectionMode
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import { toPng, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { CustomNode } from '@/components/mindmap/CustomNode';
import { Sidebar } from '@/components/mindmap/Sidebar';
import { Toolbar } from '@/components/mindmap/Toolbar';
import { getLayoutedElements, LayoutDirection } from '@/lib/layout';
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { themes, ThemeId } from '@/lib/themes';

// Helper to compute bounding box of all nodes
const getNodesBounds = (nodes: Node[]) => {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  nodes.forEach(node => {
    const width = (node.data?.width as number) || 200;
    const height = (node.data?.height as number) || 100;
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  });
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
};

const nodeTypes = {
  custom: CustomNode,
};

const initialNodes: Node[] = [
  { 
    id: '1', 
    type: 'custom', 
    position: { x: 0, y: 0 }, 
    data: { label: '# 中心主题\n在这里开始你的思维导图' },
    selected: true
  },
];
const initialEdges: Edge[] = [];

// Helper to apply theme to CSS variables
const applyTheme = (themeId: ThemeId) => {
  const theme = themes.find(t => t.id === themeId) || themes[0];
  const root = document.documentElement;

  // Set class for dark mode if needed
  if (theme.type === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Set CSS variables
  Object.entries(theme.colors).forEach(([key, value]) => {
    // CamelCase to kebab-case for CSS vars
    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    root.style.setProperty(cssVar, value);
  });
};

function MindMapContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [currentTheme, setCurrentTheme] = useState<ThemeId>('light');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const { fitView, getNodes, getEdges, setViewport, getViewport } = useReactFlow();
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
  // Handle node data updates (Memoized to be stable)
  const onNodeDataChange = useCallback((id: string, newLabel: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, label: newLabel } };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Handle node resize
  const onNodeResize = useCallback((id: string, width: number, height: number) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, width, height } };
        }
        return node;
      })
    );
  }, [setNodes]);

  // Handle edit mode start
  const onEditStart = useCallback((id: string) => {
    setEditingNodeId(id);
  }, []);

  // Handle edit mode end
  const onEditEnd = useCallback((id: string) => {
    setEditingNodeId(null);
  }, []);

  // Initialize Theme and Load Auto-save
  useEffect(() => {
    // Load Theme
    const savedTheme = localStorage.getItem('mindflow-theme') as ThemeId;
    if (savedTheme && themes.some(t => t.id === savedTheme)) {
      setCurrentTheme(savedTheme);
      applyTheme(savedTheme);
    } else {
      applyTheme('light');
    }

    // Load Data
    const savedData = localStorage.getItem('mindflow-autosave');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        if (data.nodes && data.edges) {
          setNodes(data.nodes);
          setEdges(data.edges);
          if (data.viewport) setViewport(data.viewport);
          toast({ title: "已恢复", description: "已恢复上次的会话内容", duration: 2000 });
        }
      } catch (e) {
        console.error("Failed to load autosave", e);
      }
    }
  }, []);

  // Ensure all nodes have the handlers
  useEffect(() => {
    setNodes((nds) => 
      nds.map((node) => {
        const needsUpdate = !node.data.onChange || !node.data.onEditStart || !node.data.onEditEnd || !node.data.onResize;
        if (needsUpdate) {
          return { 
            ...node, 
            data: { 
              ...node.data, 
              onChange: onNodeDataChange,
              onEditStart: onEditStart,
              onEditEnd: onEditEnd,
              onResize: onNodeResize
            } 
          };
        }
        return node;
      })
    );
  }, [onNodeDataChange, onEditStart, onEditEnd, onNodeResize, setNodes]);

  // Auto-Save Logic
  useEffect(() => {
    const saveData = () => {
      // Clean up handlers before saving
      const cleanNodes = getNodes().map(node => ({
        ...node,
        data: {
          label: node.data.label,
          emoji: node.data.emoji,
          width: node.data.width,
          height: node.data.height
        }
      }));
      const data = {
        nodes: cleanNodes,
        edges: getEdges(),
        viewport: getViewport()
      };
      localStorage.setItem('mindflow-autosave', JSON.stringify(data));
      localStorage.setItem('mindflow-theme', currentTheme);
    };

    const timeoutId = setTimeout(saveData, 2000); // Debounce 2s
    return () => clearTimeout(timeoutId);
  }, [nodes, edges, currentTheme, getNodes, getEdges, getViewport]);

  const handleThemeChange = (themeId: ThemeId) => {
    setCurrentTheme(themeId);
    applyTheme(themeId);
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ 
      ...params, 
      type: ConnectionLineType.Bezier, 
      animated: false,
      style: { strokeWidth: 2, stroke: '#888888' }
    }, eds)),
    [setEdges]
  );

  // Auto Layout
  const onLayout = useCallback((direction: LayoutDirection = 'LR') => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      getNodes(),
      getEdges(),
      direction
    );

    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
    
    window.requestAnimationFrame(() => {
      fitView({ duration: 400 });
    });
  }, [getNodes, getEdges, setNodes, setEdges, fitView]);

  // Load File
  const handleLoad = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.nodes && data.edges) {
        setNodes(data.nodes);
        setEdges(data.edges);
        
        if (data.viewport) {
            setViewport(data.viewport);
        } else {
            setTimeout(() => fitView({ duration: 800 }), 100);
        }

        toast({ title: "项目已加载", description: "思维导图加载成功" });
      } else {
        throw new Error("Invalid file format");
      }
    } catch (err) {
      console.error(err);
      toast({ title: "加载失败", description: "无法加载项目文件", variant: "destructive" });
    }
  }, [setNodes, setEdges, setViewport, fitView, toast]);

  // Add Sibling Node
  const addSiblingNode = useCallback(() => {
    if (editingNodeId) return; // Don't add sibling while editing
    
    const selectedNodes = getNodes().filter(n => n.selected);
    if (selectedNodes.length === 0) {
      toast({ title: "未选中节点", description: "请先选择一个节点", variant: "destructive" });
      return;
    }
    
    const selected = selectedNodes[0];
    const newNodeId = nanoid();
    
    // Add sibling (same level, below)
    const newNode: Node = {
      id: newNodeId,
      type: 'custom',
      position: { x: selected.position.x, y: selected.position.y + 100 },
      data: { 
        label: '新节点', 
        onChange: onNodeDataChange,
        onEditStart: onEditStart,
        onEditEnd: onEditEnd,
        onResize: onNodeResize
      },
      selected: true
    };

    // Deselect previous and add new
    setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), newNode]);
    
    // Find parent of selected node
    const parentEdge = getEdges().find(e => e.target === selected.id);
    if (parentEdge) {
      const newEdge: Edge = {
        id: `e${parentEdge.source}-${newNodeId}`,
        source: parentEdge.source,
        target: newNodeId,
        type: ConnectionLineType.Bezier,
        animated: false,
        style: { strokeWidth: 2, stroke: '#888888' },
      };
      setEdges((eds) => eds.concat(newEdge));
    }
  }, [editingNodeId, getNodes, getEdges, onNodeDataChange, onEditStart, onEditEnd, onNodeResize, setNodes, setEdges, toast]);

  // Add Child Node (direction: 'right' or 'left')
  const addChildNode = useCallback((direction: 'right' | 'left' = 'right') => {
    if (editingNodeId) return; // Don't add child while editing
    
    const selectedNodes = getNodes().filter(n => n.selected);
    if (selectedNodes.length === 0) {
      toast({ title: "未选中节点", description: "请先选择一个节点再添加子节点", variant: "destructive" });
      return;
    }
    
    const parent = selectedNodes[0];
    const newNodeId = nanoid();
    
    // Calculate position based on direction
    const xOffset = direction === 'right' ? 350 : -350;
    const newNode: Node = {
      id: newNodeId,
      type: 'custom',
      position: { x: parent.position.x + xOffset, y: parent.position.y + (Math.random() * 50 - 25) },
      data: { 
        label: '新想法', 
        onChange: onNodeDataChange,
        onEditStart: onEditStart,
        onEditEnd: onEditEnd,
        onResize: onNodeResize
      },
      selected: true
    };

    // Deselect parent
    setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), newNode]);

    const newEdge: Edge = {
      id: `e${parent.id}-${newNodeId}`,
      source: parent.id,
      target: newNodeId,
      type: ConnectionLineType.Bezier,
      animated: false,
      style: { strokeWidth: 2, stroke: '#888888' },
    };

    setEdges((eds) => eds.concat(newEdge));
    
  }, [editingNodeId, getNodes, onNodeDataChange, onEditStart, onEditEnd, onNodeResize, setNodes, setEdges, toast]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle shortcuts while editing
      if (editingNodeId) return;
      
      if (event.key === 'Tab') {
        event.preventDefault();
        if (event.shiftKey) {
          addChildNode('left');
        } else {
          addChildNode('right');
        }
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        addSiblingNode();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [addChildNode, addSiblingNode, editingNodeId]);

  // Formatting Toolbar Action with selection support
  const handleFormat = (formatStr: string, selectedText?: string) => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length === 0) return;

    const activeElement = document.activeElement as HTMLTextAreaElement;
    const isTextarea = activeElement && activeElement.tagName === 'TEXTAREA';
    
    if (isTextarea && activeElement.selectionStart !== activeElement.selectionEnd) {
      const start = activeElement.selectionStart;
      const end = activeElement.selectionEnd;
      const text = activeElement.value;
      const selected = text.substring(start, end);
      
      let wrappedText = selected;
      if (formatStr === "**text**") {
        wrappedText = `**${selected}**`;
      } else if (formatStr === "*text*") {
        wrappedText = `*${selected}*`;
      } else if (formatStr === "<u>text</u>") {
        wrappedText = `<u>${selected}</u>`;
      } else if (formatStr === "# text") {
        wrappedText = `# ${selected}`;
      } else if (formatStr === "`text`") {
        wrappedText = `\`${selected}\``;
      } else if (formatStr === "$x^2$") {
        wrappedText = `$${selected}$`;
      } else if (formatStr === "[title](url)") {
        wrappedText = `[${selected}](url)`;
      } else if (formatStr === "==text==") {
        wrappedText = `==${selected}==`;
      } else {
        wrappedText = selected + formatStr;
      }
      
      const newValue = text.substring(0, start) + wrappedText + text.substring(end);
      
      const nodeId = activeElement.closest('[data-node-id]')?.getAttribute('data-node-id');
      if (nodeId) {
        setNodes(nds => nds.map(n => {
          if (n.id === nodeId) {
            return { ...n, data: { ...n.data, label: newValue } };
          }
          return n;
        }));
        
        setTimeout(() => {
          activeElement.focus();
          activeElement.setSelectionRange(start, start + wrappedText.length);
        }, 0);
      }
    } else {
      setNodes(nds => nds.map(n => {
        if (n.selected) {
          let newLabel = n.data.label as string;
          
          if (selectedText) {
            if (formatStr === "**text**") {
              newLabel = newLabel.replace(selectedText, `**${selectedText}**`);
            } else if (formatStr === "*text*") {
              newLabel = newLabel.replace(selectedText, `*${selectedText}*`);
            } else if (formatStr === "<u>text</u>") {
              newLabel = newLabel.replace(selectedText, `<u>${selectedText}</u>`);
            } else if (formatStr === "# text") {
              newLabel = newLabel.replace(selectedText, `# ${selectedText}`);
            } else if (formatStr === "`text`") {
              newLabel = newLabel.replace(selectedText, `\`${selectedText}\``);
            } else if (formatStr === "$x^2$") {
              newLabel = newLabel.replace(selectedText, `$${selectedText}$`);
            } else if (formatStr === "[title](url)") {
              newLabel = newLabel.replace(selectedText, `[${selectedText}](url)`);
            } else if (formatStr === "==text==") {
              newLabel = newLabel.replace(selectedText, `==${selectedText}==`);
            } else {
              newLabel = newLabel.replace(selectedText, selectedText + formatStr);
            }
          } else {
            if (formatStr.includes("text")) {
              newLabel += "\n" + formatStr.replace("text", "新文本");
            } else {
              newLabel += formatStr;
            }
          }
          return { ...n, data: { ...n.data, label: newLabel } };
        }
        return n;
      }));
    }
  };
  
  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      if (imageUrl) {
         setNodes(nds => nds.map(n => {
          if (n.selected) {
             const newLabel = (n.data.label as string) + `\n\n![图片](${imageUrl})`;
             return { ...n, data: { ...n.data, label: newLabel } };
          }
          return n;
         }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExport = async (type: 'png' | 'svg' | 'pdf' | 'json') => {
    if (type === 'json') {
      const cleanNodes = getNodes().map(node => ({
        ...node,
        data: {
          label: node.data.label,
          emoji: node.data.emoji,
          width: node.data.width,
          height: node.data.height
        }
      }));
      const data = { nodes: cleanNodes, edges: getEdges() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mindmap.json';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    // First fit view to show all content
    fitView({ padding: 0.2 });
    
    // Wait for fitView animation
    await new Promise(resolve => setTimeout(resolve, 500));

    const flowElement = document.querySelector('.react-flow') as HTMLElement;
    if (!flowElement) {
      toast({ title: "导出失败", description: "无法找到画布元素", variant: "destructive" });
      return;
    }

    try {
      const exportOptions = {
        backgroundColor: '#ffffff',
        style: {
          background: '#ffffff'
        },
        filter: (node: Element) => {
          const className = node.className?.toString() || '';
          if (className.includes('react-flow__controls') || 
              className.includes('react-flow__minimap') ||
              className.includes('react-flow__panel') ||
              className.includes('react-flow__background')) {
            return false;
          }
          return true;
        },
        includeQuerySelector: '.react-flow__edges'
      };

      if (type === 'png') {
        const dataUrl = await toPng(flowElement, exportOptions);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'mindmap.png';
        a.click();
        toast({ title: "导出成功", description: "PNG 文件已下载" });
      } else if (type === 'svg') {
        const dataUrl = await toSvg(flowElement, exportOptions);
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'mindmap.svg';
        a.click();
        toast({ title: "导出成功", description: "SVG 文件已下载" });
      } else if (type === 'pdf') {
        const dataUrl = await toPng(flowElement, exportOptions);
        const pdf = new jsPDF({
          orientation: flowElement.offsetWidth > flowElement.offsetHeight ? 'landscape' : 'portrait',
          unit: 'px',
          format: [flowElement.offsetWidth, flowElement.offsetHeight]
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, flowElement.offsetWidth, flowElement.offsetHeight);
        pdf.save('mindmap.pdf');
        toast({ title: "导出成功", description: "PDF 文件已下载" });
      }
    } catch (err) {
      console.error('Export error:', err);
      toast({ title: "导出失败", description: "无法导出思维导图", variant: "destructive" });
    }
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden transition-colors duration-300">
      <Sidebar 
        onExport={handleExport} 
        onLayout={onLayout} 
        onLoad={handleLoad} 
        currentTheme={currentTheme}
        onThemeChange={handleThemeChange}
        onAddChild={addChildNode}
      />
      
      <div className="flex-1 relative h-full flex flex-col" ref={reactFlowWrapper}>
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <Toolbar onFormat={handleFormat} onImageUpload={handleImageUpload} />
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          connectionLineType={ConnectionLineType.Bezier}
          fitView
          className="bg-canvas-bg"
          minZoom={0.1}
          panOnScroll={editingNodeId === null}
          zoomOnScroll={editingNodeId === null}
          selectionOnDrag={true}
          panOnDrag={[2]} // Right mouse button for panning
          selectionMode={SelectionMode.Partial}
          nodesDraggable={editingNodeId === null}
          defaultEdgeOptions={{ 
            type: ConnectionLineType.Bezier, 
            animated: false,
            style: { strokeWidth: 2, stroke: '#888888' } 
          }}
        >
          <Controls className="bg-card border-border fill-foreground text-foreground" />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-50" />
          <Panel position="bottom-right" className="text-xs text-muted-foreground opacity-50 select-none">
             右键拖动平移 • 滚轮缩放 • Tab 右侧子节点 • Shift+Tab 左侧子节点 • Enter 同级节点
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

export default function MindMapPage() {
  return (
    <ReactFlowProvider>
      <MindMapContent />
    </ReactFlowProvider>
  );
}
