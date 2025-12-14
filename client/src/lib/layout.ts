import dagre from 'dagre';
import { Node, Edge, Position } from '@xyflow/react';

export const nodeWidth = 250;
export const nodeHeight = 80;

export type LayoutDirection = 'TB' | 'LR' | 'radial';

const findRootNodes = (nodes: Node[], edges: Edge[]): Node[] => {
  const targetIds = new Set(edges.map(e => e.target));
  const roots = nodes.filter(n => !targetIds.has(n.id));
  return roots.length > 0 ? roots : (nodes.length > 0 ? [nodes[0]] : []);
};

const buildTree = (nodes: Node[], edges: Edge[]): { children: Map<string, string[]>, parent: Map<string, string> } => {
  const children = new Map<string, string[]>();
  const parent = new Map<string, string>();
  nodes.forEach(n => children.set(n.id, []));
  edges.forEach(e => {
    const parentChildren = children.get(e.source);
    if (parentChildren) {
      parentChildren.push(e.target);
    }
    parent.set(e.target, e.source);
  });
  return { children, parent };
};

const getHandlePositionFromAngle = (angle: number): { target: Position, source: Position } => {
  const normalizedAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  
  if (normalizedAngle >= 7 * Math.PI / 4 || normalizedAngle < Math.PI / 4) {
    return { target: Position.Left, source: Position.Right };
  } else if (normalizedAngle >= Math.PI / 4 && normalizedAngle < 3 * Math.PI / 4) {
    return { target: Position.Top, source: Position.Bottom };
  } else if (normalizedAngle >= 3 * Math.PI / 4 && normalizedAngle < 5 * Math.PI / 4) {
    return { target: Position.Right, source: Position.Left };
  } else {
    return { target: Position.Bottom, source: Position.Top };
  }
};

const radialLayout = (nodes: Node[], edges: Edge[]): Node[] => {
  if (nodes.length === 0) return nodes;

  const roots = findRootNodes(nodes, edges);
  const { children, parent } = buildTree(nodes, edges);
  const positions = new Map<string, { x: number; y: number }>();
  const handlePositions = new Map<string, { target: Position; source: Position }>();
  const visited = new Set<string>();

  const baseRadius = 250;
  const radiusIncrement = 200;

  const layoutTree = (rootId: string, offsetX: number, offsetY: number) => {
    const levels = new Map<string, number>();
    
    const calculateLevels = (nodeId: string, level: number) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      levels.set(nodeId, level);
      const nodeChildren = children.get(nodeId) || [];
      nodeChildren.forEach(child => calculateLevels(child, level + 1));
    };
    calculateLevels(rootId, 0);

    positions.set(rootId, { x: offsetX, y: offsetY });

    const positionChildren = (parentId: string, startAngle: number, endAngle: number): number[] => {
      const nodeChildren = children.get(parentId) || [];
      if (nodeChildren.length === 0) return [];

      const parentLevel = levels.get(parentId) || 0;
      const radius = baseRadius + parentLevel * radiusIncrement;
      const angleStep = (endAngle - startAngle) / nodeChildren.length;
      const parentPos = positions.get(parentId)!;
      const childAngles: number[] = [];

      nodeChildren.forEach((childId, index) => {
        const angle = startAngle + angleStep * (index + 0.5);
        childAngles.push(angle);
        const x = parentPos.x + Math.cos(angle) * radius;
        const y = parentPos.y + Math.sin(angle) * radius;
        positions.set(childId, { x, y });
        
        const angleToParent = Math.atan2(parentPos.y - y, parentPos.x - x);
        const handles = getHandlePositionFromAngle(angleToParent);
        handlePositions.set(childId, handles);
        
        const childAngleSpan = angleStep * 0.85;
        positionChildren(childId, angle - childAngleSpan / 2, angle + childAngleSpan / 2);
      });
      
      return childAngles;
    };

    const rootChildAngles = positionChildren(rootId, -Math.PI / 2, 3 * Math.PI / 2);
    
    if (rootChildAngles.length > 0) {
      let sumX = 0, sumY = 0;
      rootChildAngles.forEach(angle => {
        sumX += Math.cos(angle);
        sumY += Math.sin(angle);
      });
      const avgAngle = Math.atan2(sumY, sumX);
      handlePositions.set(rootId, getHandlePositionFromAngle(avgAngle));
    } else {
      handlePositions.set(rootId, { target: Position.Left, source: Position.Right });
    }
  };

  let currentOffset = 0;
  roots.forEach((root, index) => {
    layoutTree(root.id, currentOffset, 0);
    currentOffset += 800;
  });

  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      positions.set(node.id, { x: currentOffset, y: 0 });
      handlePositions.set(node.id, { target: Position.Left, source: Position.Right });
      currentOffset += 400;
    }
  });

  return nodes.map(node => {
    const pos = positions.get(node.id) || { x: 0, y: 0 };
    const handles = handlePositions.get(node.id) || { target: Position.Left, source: Position.Right };
    const nodeW = node.measured?.width ?? nodeWidth;
    const nodeH = node.measured?.height ?? nodeHeight;

    return {
      ...node,
      targetPosition: handles.target,
      sourcePosition: handles.source,
      position: {
        x: pos.x - nodeW / 2,
        y: pos.y - nodeH / 2,
      },
    };
  });
};

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction: LayoutDirection = 'LR') => {
  if (direction === 'radial') {
    return { nodes: radialLayout(nodes, edges), edges };
  }

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: isHorizontal ? 50 : 80,
    ranksep: isHorizontal ? 100 : 120,
    marginx: 50,
    marginy: 50
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { 
      width: node.measured?.width ?? nodeWidth, 
      height: node.measured?.height ?? nodeHeight 
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - (node.measured?.width ?? nodeWidth) / 2,
        y: nodeWithPosition.y - (node.measured?.height ?? nodeHeight) / 2,
      },
    };

    return newNode;
  });

  return { nodes: newNodes, edges };
};
