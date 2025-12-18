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
  const { children } = buildTree(nodes, edges);
  const positions = new Map<string, { x: number; y: number }>();
  const handlePositions = new Map<string, { target: Position; source: Position }>();
  const visited = new Set<string>();

  // Increased spacing for better readability
  const baseRadius = 350;
  const radiusIncrement = 280;
  const minAngleSpacing = 0.3; // Minimum angle between siblings (in radians)

  const getNodeSize = (nodeId: string): { width: number; height: number } => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { width: nodeWidth, height: nodeHeight };
    return {
      width: node.measured?.width ?? nodeWidth,
      height: node.measured?.height ?? nodeHeight
    };
  };

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
      const parentPos = positions.get(parentId)!;
      const childAngles: number[] = [];

      // Calculate required angle span based on number of children
      const availableAngle = endAngle - startAngle;
      const minRequiredAngle = nodeChildren.length * minAngleSpacing;
      const angleStep = Math.max(availableAngle / nodeChildren.length, minAngleSpacing);

      nodeChildren.forEach((childId, index) => {
        const angle = startAngle + angleStep * (index + 0.5);
        childAngles.push(angle);
        const x = parentPos.x + Math.cos(angle) * radius;
        const y = parentPos.y + Math.sin(angle) * radius;
        positions.set(childId, { x, y });
        
        const angleToParent = Math.atan2(parentPos.y - y, parentPos.x - x);
        const handles = getHandlePositionFromAngle(angleToParent);
        handlePositions.set(childId, handles);
        
        // Give children more space
        const childAngleSpan = Math.min(angleStep * 0.9, availableAngle / nodeChildren.length);
        positionChildren(childId, angle - childAngleSpan / 2, angle + childAngleSpan / 2);
      });
      
      return childAngles;
    };

    const rootChildAngles = positionChildren(rootId, 0, 2 * Math.PI);
    
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
  roots.forEach((root) => {
    layoutTree(root.id, currentOffset + 600, 600);
    currentOffset += 1200;
  });

  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      positions.set(node.id, { x: currentOffset + 600, y: 600 });
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

// Horizontal Layout - Smart layout based on actual node sizes
const horizontalLayout = (nodes: Node[], edges: Edge[]): { nodes: Node[], edges: Edge[] } => {
  if (nodes.length === 0) return { nodes, edges };
  
  // Find root node
  const targetIds = new Set(edges.map(e => e.target));
  const rootNodes = nodes.filter(n => !targetIds.has(n.id));
  const rootNode = rootNodes.length > 0 ? rootNodes[0] : nodes[0];
  
  if (!rootNode) return { nodes, edges };
  
  // Build tree structure and node map
  const { children } = buildTree(nodes, edges);
  const nodeMap = new Map<string, Node>(nodes.map(n => [n.id, n]));
  
  const rootX = 800;
  const rootY = 500;
  const horizontalSpacing = 350;
  const minVerticalGap = 30; // 节点之间的最小垂直间距
  
  const positions = new Map<string, { x: number; y: number }>();
  const handlePositions = new Map<string, { target: Position; source: Position }>();
  
  // Position root
  positions.set(rootNode.id, { x: rootX, y: rootY });
  handlePositions.set(rootNode.id, { target: Position.Left, source: Position.Right });
  
  // Get actual node height
  const getNodeHeight = (nodeId: string): number => {
    const node = nodeMap.get(nodeId);
    if (!node) return nodeHeight;
    return (node.measured?.height ?? node.data?.height ?? nodeHeight) + minVerticalGap;
  };
  
  // Calculate subtree height (total vertical space needed)
  const calcSubtreeHeight = (nodeId: string, memo = new Map<string, number>()): number => {
    if (memo.has(nodeId)) return memo.get(nodeId)!;
    
    const kids = children.get(nodeId) || [];
    if (kids.length === 0) {
      const h = getNodeHeight(nodeId);
      memo.set(nodeId, h);
      return h;
    }
    
    // Sum of all children's heights
    let totalChildHeight = 0;
    kids.forEach(kid => {
      totalChildHeight += calcSubtreeHeight(kid, memo);
    });
    
    // Return max of node height or total children height
    const result = Math.max(getNodeHeight(nodeId), totalChildHeight);
    memo.set(nodeId, result);
    return result;
  };
  
  // Layout subtree with proportional space allocation
  const layoutSubtree = (nodeId: string, x: number, startY: number, endY: number, direction: 'left' | 'right', visited: Set<string>) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    // Position this node in the center of its allocated space
    const centerY = (startY + endY) / 2;
    positions.set(nodeId, { x, y: centerY });
    handlePositions.set(nodeId, {
      target: direction === 'left' ? Position.Right : Position.Left,
      source: direction === 'left' ? Position.Left : Position.Right
    });
    
    const kids = children.get(nodeId) || [];
    if (kids.length === 0) return;
    
    // Calculate heights for all children
    const childHeights = kids.map(kid => calcSubtreeHeight(kid));
    const totalChildHeight = childHeights.reduce((sum, h) => sum + h, 0);
    
    // Allocate space proportionally to each child
    const nextX = x + (direction === 'left' ? -horizontalSpacing : horizontalSpacing);
    let currentY = startY;
    
    kids.forEach((kid, i) => {
      const childHeight = childHeights[i];
      const childSpace = (endY - startY) * (childHeight / totalChildHeight);
      layoutSubtree(kid, nextX, currentY, currentY + childSpace, direction, visited);
      currentY += childSpace;
    });
  };
  
  // Get root children and determine sides
  const rootChildren = children.get(rootNode.id) || [];
  const leftChildren: string[] = [];
  const rightChildren: string[] = [];
  
  rootChildren.forEach((childId, index) => {
    const edge = edges.find(e => e.source === rootNode.id && e.target === childId);
    const childNode = nodes.find(n => n.id === childId);
    
    if (edge?.sourceHandle === 'left') {
      leftChildren.push(childId);
    } else if (edge?.sourceHandle === 'right') {
      rightChildren.push(childId);
    } else if (childNode) {
      const childX = childNode.position.x + (childNode.measured?.width ?? nodeWidth) / 2;
      const rootX2 = rootNode.position.x + (rootNode.measured?.width ?? nodeWidth) / 2;
      if (childX < rootX2) {
        leftChildren.push(childId);
      } else {
        rightChildren.push(childId);
      }
    } else {
      if (index % 2 === 0) rightChildren.push(childId);
      else leftChildren.push(childId);
    }
  });
  
  // Calculate total heights for both sides
  const leftHeights = leftChildren.map(id => calcSubtreeHeight(id));
  const rightHeights = rightChildren.map(id => calcSubtreeHeight(id));
  const leftTotal = leftHeights.reduce((sum, h) => sum + h, 0);
  const rightTotal = rightHeights.reduce((sum, h) => sum + h, 0);
  const maxTotal = Math.max(leftTotal, rightTotal, 300); // At least 300px total height
  
  // Layout left side
  let leftY = rootY - maxTotal / 2;
  leftChildren.forEach((childId, i) => {
    const childHeight = leftHeights[i];
    const childSpace = maxTotal * (childHeight / leftTotal);
    layoutSubtree(childId, rootX - horizontalSpacing, leftY, leftY + childSpace, 'left', new Set());
    leftY += childSpace;
  });
  
  // Layout right side
  let rightY = rootY - maxTotal / 2;
  rightChildren.forEach((childId, i) => {
    const childHeight = rightHeights[i];
    const childSpace = maxTotal * (childHeight / rightTotal);
    layoutSubtree(childId, rootX + horizontalSpacing, rightY, rightY + childSpace, 'right', new Set());
    rightY += childSpace;
  });
  
  // Handle orphaned nodes
  nodes.forEach(node => {
    if (!positions.has(node.id)) {
      positions.set(node.id, { x: rootX + 500, y: rootY });
      handlePositions.set(node.id, { target: Position.Left, source: Position.Right });
    }
  });
  
  // Create new nodes
  const newNodes = nodes.map(node => {
    const pos = positions.get(node.id)!;
    const handles = handlePositions.get(node.id)!;
    const nodeW = node.measured?.width ?? nodeWidth;
    const nodeH = node.measured?.height ?? nodeHeight;
    
    return {
      ...node,
      targetPosition: handles.target,
      sourcePosition: handles.source,
      position: { x: pos.x - nodeW / 2, y: pos.y - nodeH / 2 },
    };
  });
  
  // Update edges
  const newEdges = edges.map(edge => {
    const src = newNodes.find(n => n.id === edge.source);
    const tgt = newNodes.find(n => n.id === edge.target);
    if (!src || !tgt) return edge;
    
    const srcHandle = src.id === rootNode.id 
      ? (positions.get(edge.target)!.x < rootX ? 'left' : 'right')
      : (src.sourcePosition === Position.Left ? 'left' : 'right');
    const tgtHandle = tgt.targetPosition === Position.Left ? 'left' : 'right';
    
    return { ...edge, sourceHandle: srcHandle, targetHandle: tgtHandle };
  });
  
  return { nodes: newNodes, edges: newEdges };
};

export const getLayoutedElements = (nodes: Node[], edges: Edge[], direction: LayoutDirection = 'LR') => {
  if (direction === 'radial') {
    return { nodes: radialLayout(nodes, edges), edges };
  }
  
  // Use horizontal layout for LR direction
  if (direction === 'LR') {
    return horizontalLayout(nodes, edges);
  }

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isHorizontal = direction === 'LR';
  
  // Find root nodes
  const targetIds = new Set(edges.map(e => e.target));
  const rootNodes = nodes.filter(n => !targetIds.has(n.id));
  const rootNode = rootNodes.length > 0 ? rootNodes[0] : nodes[0];
  
  // Determine which nodes are on the left side (horizontal) or top side (vertical) by checking edge sourceHandle
  const leftSideNodes = new Set<string>();
  const topSideNodes = new Set<string>();
  
  if (rootNode) {
    if (isHorizontal) {
      // First, check current positions
      nodes.forEach(node => {
        if (node.id !== rootNode.id) {
          const nodeCenterX = node.position.x + (node.measured?.width ?? nodeWidth) / 2;
          const rootCenterX = rootNode.position.x + (rootNode.measured?.width ?? nodeWidth) / 2;
          if (nodeCenterX < rootCenterX) {
            leftSideNodes.add(node.id);
          }
        }
      });
      
      // Also check edges to determine direction
      edges.forEach(edge => {
        if (edge.sourceHandle === 'left') {
          leftSideNodes.add(edge.target);
        }
      });
    } else {
      // For vertical layout, determine top/bottom
      nodes.forEach(node => {
        if (node.id !== rootNode.id) {
          const nodeCenterY = node.position.y + (node.measured?.height ?? nodeHeight) / 2;
          const rootCenterY = rootNode.position.y + (rootNode.measured?.height ?? nodeHeight) / 2;
          if (nodeCenterY < rootCenterY) {
            topSideNodes.add(node.id);
          }
        }
      });
      
      // Check edges to determine direction
      edges.forEach(edge => {
        if (edge.sourceHandle === 'top') {
          topSideNodes.add(edge.target);
        }
      });
    }
  }
  
  dagreGraph.setGraph({ 
    rankdir: direction,
    nodesep: isHorizontal ? 120 : 150, // Increased horizontal spacing between nodes
    ranksep: isHorizontal ? 300 : 250, // Increased vertical spacing between levels
    marginx: 150,
    marginy: 150,
    align: 'UL',
    acyclicer: 'greedy',
    ranker: 'network-simplex'
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

  // Group nodes by level for even distribution
  const nodesByLevel = new Map<number, Array<{ node: Node; pos: dagre.Node }>>();
  let minLevel = Infinity, maxLevel = -Infinity;
  
  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    if (nodeWithPosition) {
      const level = (node.data?.level as number) ?? 0;
      minLevel = Math.min(minLevel, level);
      maxLevel = Math.max(maxLevel, level);
      
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level)!.push({ node, pos: nodeWithPosition });
    }
  });
  
  // Calculate spacing - increased for better readability
  const minVerticalSpacing = isHorizontal ? 180 : 250;
  const minHorizontalSpacing = isHorizontal ? 400 : 250;
  const verticalRange = isHorizontal ? 1200 : 1000; // Available vertical space per level
  
  // Evenly distribute nodes within each level
  nodesByLevel.forEach((nodesInLevel, level) => {
    if (nodesInLevel.length === 0) return;
    
    // Sort nodes by current position
    nodesInLevel.sort((a, b) => {
      if (isHorizontal) {
        return a.pos.y - b.pos.y;
      } else {
        return a.pos.x - b.pos.x;
      }
    });
    
    // Calculate base position for this level
    const levelIndex = level - minLevel;
    const basePos = levelIndex * (isHorizontal ? minHorizontalSpacing : minVerticalSpacing) + 300;
    
    if (nodesInLevel.length === 1) {
      // Single node: center it
      if (isHorizontal) {
        nodesInLevel[0].pos.x = basePos;
        nodesInLevel[0].pos.y = 400; // Center vertically
      } else {
        nodesInLevel[0].pos.x = 400; // Center horizontally
        nodesInLevel[0].pos.y = basePos;
      }
    } else {
      // Multiple nodes: distribute evenly across available space
      const spacing = Math.max(verticalRange / (nodesInLevel.length + 1), 100);
      const startPos = 200 + spacing; // Start with margin
      
      nodesInLevel.forEach((item, index) => {
        if (isHorizontal) {
          item.pos.x = basePos;
          item.pos.y = startPos + index * spacing;
        } else {
          item.pos.x = startPos + index * spacing;
          item.pos.y = basePos;
        }
      });
    }
  });

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    if (!nodeWithPosition) return node;
    
    let finalX = nodeWithPosition.x - (node.measured?.width ?? nodeWidth) / 2;
    let finalY = nodeWithPosition.y - (node.measured?.height ?? nodeHeight) / 2;
    
    let targetPos: Position;
    let sourcePos: Position;
    
    if (isHorizontal) {
      // For horizontal layout, preserve left/right side based on sourceHandle
      if (rootNode && node.id !== rootNode.id) {
        const rootX = dagreGraph.node(rootNode.id).x;
        const nodeX = nodeWithPosition.x;
        const shouldBeOnLeft = leftSideNodes.has(node.id);
        const isOnLeft = nodeX < rootX;
        
        // If node should be on left but dagre put it on right, flip it
        if (shouldBeOnLeft && !isOnLeft) {
          // Calculate distance from root and flip to left side
          const distance = nodeX - rootX;
          finalX = rootX - distance - (node.measured?.width ?? nodeWidth);
        } else if (!shouldBeOnLeft && isOnLeft) {
          // Node should be on right but is on left, flip it
          const distance = rootX - nodeX;
          finalX = rootX + distance - (node.measured?.width ?? nodeWidth) / 2;
        }
      }
      
      // Set target and source positions based on which side the node is on
      if (rootNode && node.id !== rootNode.id && leftSideNodes.has(node.id)) {
        // Left side: child's right connects to parent's left
        // So child needs target on right, source on left
        targetPos = Position.Right;
        sourcePos = Position.Left;
      } else if (rootNode && node.id === rootNode.id) {
        // Root node: check if it has children on both sides
        const hasLeftChildren = edges.some(e => e.source === rootNode.id && e.sourceHandle === 'left');
        const hasRightChildren = edges.some(e => e.source === rootNode.id && e.sourceHandle === 'right');
        
        // Root can connect to both sides, but we need to set handles correctly
        targetPos = Position.Left;
        // Source position will be set based on children, but we need both handles available
        sourcePos = Position.Right;
      } else {
        // Right side: child's left connects to parent's right
        // So child needs target on left, source on right
        targetPos = Position.Left;
        sourcePos = Position.Right;
      }
    } else {
      // For vertical layout, preserve top/bottom side based on sourceHandle
      if (rootNode && node.id !== rootNode.id) {
        const rootY = dagreGraph.node(rootNode.id).y;
        const nodeY = nodeWithPosition.y;
        const shouldBeOnTop = topSideNodes.has(node.id);
        const isOnTop = nodeY < rootY;
        
        // If node should be on top but dagre put it on bottom, flip it
        if (shouldBeOnTop && !isOnTop) {
          const distance = nodeY - rootY;
          finalY = rootY - distance - (node.measured?.height ?? nodeHeight);
        } else if (!shouldBeOnTop && isOnTop) {
          const distance = rootY - nodeY;
          finalY = rootY + distance - (node.measured?.height ?? nodeHeight) / 2;
        }
      }
      
      // Set target and source positions based on which side the node is on
      if (rootNode && node.id !== rootNode.id && topSideNodes.has(node.id)) {
        // Top side: child's bottom connects to parent's top
        // So child needs target on bottom, source on top
        targetPos = Position.Bottom;
        sourcePos = Position.Top;
      } else if (rootNode && node.id === rootNode.id) {
        // Root node: can connect to both sides
        targetPos = Position.Top;
        sourcePos = Position.Bottom;
      } else {
        // Bottom side: child's top connects to parent's bottom
        // So child needs target on top, source on bottom
        targetPos = Position.Top;
        sourcePos = Position.Bottom;
      }
    }
    
    const newNode = {
      ...node,
      targetPosition: targetPos,
      sourcePosition: sourcePos,
      position: {
        x: finalX,
        y: finalY,
      },
    };

    return newNode;
  });

  // Update edges to have correct sourceHandle and targetHandle
  const newEdges = edges.map((edge) => {
    const sourceNode = newNodes.find(n => n.id === edge.source);
    const targetNode = newNodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) return edge;
    
    let sourceHandle: string | undefined = edge.sourceHandle;
    let targetHandle: string | undefined = edge.targetHandle;
    
    if (isHorizontal) {
      // For root node, use the original sourceHandle from edge
      if (sourceNode.id === rootNode.id) {
        // Keep the original sourceHandle (left or right)
        sourceHandle = edge.sourceHandle || 'right';
      } else {
        // For other nodes, determine based on sourcePosition
        if (sourceNode.sourcePosition === Position.Left) {
          sourceHandle = 'left';
        } else if (sourceNode.sourcePosition === Position.Right) {
          sourceHandle = 'right';
        }
      }
      
      // Target handle based on targetPosition
      if (targetNode.targetPosition === Position.Left) {
        targetHandle = 'left';
      } else if (targetNode.targetPosition === Position.Right) {
        targetHandle = 'right';
      }
    } else {
      // For vertical layout
      if (sourceNode.id === rootNode.id) {
        // Keep the original sourceHandle (top or bottom)
        sourceHandle = edge.sourceHandle || 'bottom';
      } else {
        if (sourceNode.sourcePosition === Position.Top) {
          sourceHandle = 'top';
        } else if (sourceNode.sourcePosition === Position.Bottom) {
          sourceHandle = 'bottom';
        }
      }
      
      if (targetNode.targetPosition === Position.Top) {
        targetHandle = 'top';
      } else if (targetNode.targetPosition === Position.Bottom) {
        targetHandle = 'bottom';
      }
    }
    
    return {
      ...edge,
      sourceHandle,
      targetHandle,
    };
  });

  return { nodes: newNodes, edges: newEdges };
};
