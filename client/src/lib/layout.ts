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
      // --- Compute a radius that guarantees no overlap between parent and its children ---
      // 1. Base radius by level
      let radius = baseRadius + parentLevel * radiusIncrement;

      // 2. Get parent size
      const parentSize = getNodeSize(parentId);
      const parentHalfDiagonal = Math.max(parentSize.width, parentSize.height) / 2;

      // 3. Get the largest child size for this parent
      let maxChildHalfDiagonal = 0;
      nodeChildren.forEach((childId) => {
        const childSize = getNodeSize(childId);
        const childHalfDiagonal = Math.max(childSize.width, childSize.height) / 2;
        if (childHalfDiagonal > maxChildHalfDiagonal) {
          maxChildHalfDiagonal = childHalfDiagonal;
        }
      });

      // 4. Ensure radial distance is large enough to avoid parent/child overlap
      const minRequiredRadius = parentHalfDiagonal + maxChildHalfDiagonal + 80; // extra padding
      if (radius < minRequiredRadius) {
        radius = minRequiredRadius;
      }

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

  // After initial radial placement, ensure that each child is shifted horizontally
  // away from its parent so that their bounding boxes (with padding) don't overlap.
  // 对于右侧子节点，持续向右平移；左侧子节点持续向左平移，直到不遮挡父节点。
  const parentChildPadding = 40;
  const parentChildStep = 40;
  const maxParentChildIterations = 20;

  edges.forEach(edge => {
    const parentId = edge.source;
    const childId = edge.target;
    const parentPos = positions.get(parentId);
    const childPos = positions.get(childId);
    if (!parentPos || !childPos) return;

    const parentSize = getNodeSize(parentId);
    const childSize = getNodeSize(childId);

    let cx = childPos.x;
    const cy = childPos.y;
    const px = parentPos.x;
    const py = parentPos.y;

    // 判断子节点在父节点的左侧还是右侧
    const isRightSide = cx >= px;
    const direction = isRightSide ? 1 : -1;

    let iter = 0;
    while (iter < maxParentChildIterations) {
      const parentLeft = px - parentSize.width / 2;
      const parentRight = px + parentSize.width / 2;
      const parentTop = py - parentSize.height / 2;
      const parentBottom = py + parentSize.height / 2;

      const childLeft = cx - childSize.width / 2;
      const childRight = cx + childSize.width / 2;
      const childTop = cy - childSize.height / 2;
      const childBottom = cy + childSize.height / 2;

      const overlapsParent = !(
        childRight + parentChildPadding <= parentLeft ||
        childLeft - parentChildPadding >= parentRight ||
        childBottom + parentChildPadding <= parentTop ||
        childTop - parentChildPadding >= parentBottom
      );

      if (!overlapsParent) break;

      // 仅在水平方向上平移，保证“向外伸展”的视觉效果
      cx += direction * parentChildStep;
      iter++;
    }

    positions.set(childId, { x: cx, y: cy });
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

// Check if two nodes overlap
const nodesOverlap = (
  pos1: { x: number; y: number },
  size1: { width: number; height: number },
  pos2: { x: number; y: number },
  size2: { width: number; height: number },
  padding: number = 20
): boolean => {
  return !(
    pos1.x + size1.width + padding <= pos2.x ||
    pos2.x + size2.width + padding <= pos1.x ||
    pos1.y + size1.height + padding <= pos2.y ||
    pos2.y + size2.height + padding <= pos1.y
  );
};

// Horizontal Layout - Smart local adjustment layout
const horizontalLayout = (nodes: Node[], edges: Edge[]): { nodes: Node[], edges: Edge[] } => {
  if (nodes.length === 0) return { nodes, edges };
  
  // Find root node
  const targetIds = new Set(edges.map(e => e.target));
  const rootNodes = nodes.filter(n => !targetIds.has(n.id));
  const rootNode = rootNodes.length > 0 ? rootNodes[0] : nodes[0];
  
  if (!rootNode) return { nodes, edges };
  
  // Build tree structure and node map
  const { children, parent } = buildTree(nodes, edges);
  const nodeMap = new Map<string, Node>(nodes.map(n => [n.id, n]));
  
  const rootX = 800;
  const rootY = 500;
  const horizontalSpacing = 350;
  const baseVerticalSpacing = 30; // 初始最小间距（紧凑）
  const minPadding = 25; // 节点间最小间距
  
  const positions = new Map<string, { x: number; y: number }>();
  const handlePositions = new Map<string, { target: Position; source: Position }>();
  
  // Get node dimensions
  const getNodeSize = (nodeId: string): { width: number; height: number } => {
    const node = nodeMap.get(nodeId);
    if (!node) return { width: nodeWidth, height: nodeHeight };
    return {
      width: (node.measured?.width ?? (node.data?.width as number) ?? nodeWidth) as number,
      height: (node.measured?.height ?? (node.data?.height as number) ?? nodeHeight) as number
    };
  };
  
  // Get node bounds (top-left corner and size)
  const getNodeBounds = (nodeId: string): { x: number; y: number; width: number; height: number } | null => {
    const pos = positions.get(nodeId);
    if (!pos) return null;
    const size = getNodeSize(nodeId);
    return {
      x: pos.x - size.width / 2,
      y: pos.y - size.height / 2,
      width: size.width,
      height: size.height
    };
  };
  
  // Check if two nodes overlap
  const checkOverlap = (nodeId1: string, nodeId2: string): boolean => {
    const bounds1 = getNodeBounds(nodeId1);
    const bounds2 = getNodeBounds(nodeId2);
    if (!bounds1 || !bounds2) return false;
    
    return nodesOverlap(
      { x: bounds1.x, y: bounds1.y },
      { width: bounds1.width, height: bounds1.height },
      { x: bounds2.x, y: bounds2.y },
      { width: bounds2.width, height: bounds2.height },
      minPadding
    );
  };
  
  // Move a node and only its direct children (not entire subtree)
  // This keeps children close to their parent
  const moveNodeWithDirectChildren = (nodeId: string, deltaY: number): void => {
    const currentPos = positions.get(nodeId);
    if (!currentPos) return;
    
    positions.set(nodeId, { x: currentPos.x, y: currentPos.y + deltaY });
    
    // Only move direct children, not entire subtree
    const kids = children.get(nodeId) || [];
    kids.forEach(kidId => {
      const kidPos = positions.get(kidId);
      if (kidPos) {
        positions.set(kidId, { x: kidPos.x, y: kidPos.y + deltaY });
      }
    });
  };
  
  // Calculate subtree height (including all descendants)
  const calcSubtreeHeight = (nodeId: string): number => {
    const kids = children.get(nodeId) || [];
    const nodeSize = getNodeSize(nodeId);
    
    if (kids.length === 0) {
      return nodeSize.height;
    }
    
    // Sum of all children's subtree heights plus spacing
    let totalHeight = 0;
    kids.forEach((kidId, index) => {
      totalHeight += calcSubtreeHeight(kidId);
      if (index < kids.length - 1) {
        totalHeight += baseVerticalSpacing;
      }
    });
    
    // Return max of node height or total children height
    return Math.max(nodeSize.height, totalHeight);
  };
  
  // Initial compact layout - parent centered, children spread out from parent
  const initialLayout = (
    nodeId: string,
    x: number,
    parentY: number,
    direction: 'left' | 'right'
  ): number => {
    const kids = children.get(nodeId) || [];
    const nodeSize = getNodeSize(nodeId);
    
    // Position parent node first at parentY
    positions.set(nodeId, { x, y: parentY });
    handlePositions.set(nodeId, {
      target: direction === 'left' ? Position.Right : Position.Left,
      source: direction === 'left' ? Position.Left : Position.Right
    });
    
    if (kids.length === 0) {
      return nodeSize.height;
    }
    
    // Calculate total height needed for all children
    const childHeights: number[] = [];
    kids.forEach((kidId) => {
      childHeights.push(calcSubtreeHeight(kidId));
    });
    
    const totalChildrenHeight = childHeights.reduce((sum, h) => sum + h, 0) + 
                               (kids.length > 1 ? (kids.length - 1) * baseVerticalSpacing : 0);
    
    // Start children from parentY - totalHeight/2 (spread out from parent center)
    const nextX = x + (direction === 'left' ? -horizontalSpacing : horizontalSpacing);
    let currentY = parentY - totalChildrenHeight / 2;
    
    kids.forEach((kidId, index) => {
      const kidHeight = childHeights[index];
      
      // Position child at currentY, centered in its allocated space
      const childCenterY = currentY + kidHeight / 2;
      initialLayout(kidId, nextX, childCenterY, direction);
      
      // Move to next child position
      currentY += kidHeight + baseVerticalSpacing;
    });
    
    // Return total subtree height
    return Math.max(nodeSize.height, totalChildrenHeight);
  };
  
  // Resolve vertical overlaps by adjusting spacing between siblings only
  // This keeps children close to their parents and avoids moving entire subtrees
  const resolveOverlaps = (): void => {
    const maxIterations = 50;
    let iteration = 0;
    let hasOverlap = true;
    
    while (hasOverlap && iteration < maxIterations) {
      hasOverlap = false;
      iteration++;
      
      // Group nodes by parent (siblings)
      const siblingsByParent = new Map<string, string[]>();
      positions.forEach((pos, nodeId) => {
        const parentId = parent.get(nodeId);
        if (parentId) {
          if (!siblingsByParent.has(parentId)) {
            siblingsByParent.set(parentId, []);
          }
          siblingsByParent.get(parentId)!.push(nodeId);
        }
      });
      
      // Process siblings of each parent
      siblingsByParent.forEach((siblingIds, parentId) => {
        if (siblingIds.length < 2) return;
        
        // Sort siblings by Y position
        siblingIds.sort((a, b) => positions.get(a)!.y - positions.get(b)!.y);
        
        // Check consecutive siblings for overlap
        for (let i = 0; i < siblingIds.length - 1; i++) {
          const id1 = siblingIds[i];
          const id2 = siblingIds[i + 1];
          
          if (checkOverlap(id1, id2)) {
            hasOverlap = true;
            
            const bounds1 = getNodeBounds(id1)!;
            const bounds2 = getNodeBounds(id2)!;
            
            // Calculate how much to move id2 down
            const neededSpace = (bounds1.y + bounds1.height + minPadding) - bounds2.y;
            
            if (neededSpace > 0) {
              // Only move id2 and its direct children (not entire subtree)
              moveNodeWithDirectChildren(id2, neededSpace + 5);
              
              // Re-sort for next iteration
              siblingIds.sort((a, b) => positions.get(a)!.y - positions.get(b)!.y);
            }
          }
        }
      });
      
      // Also check nodes in the same column (for root's children and other cases)
      const nodesByColumn = new Map<number, string[]>();
      positions.forEach((pos, nodeId) => {
        const colX = Math.round(pos.x / 10) * 10;
        if (!nodesByColumn.has(colX)) {
          nodesByColumn.set(colX, []);
        }
        nodesByColumn.get(colX)!.push(nodeId);
      });
      
      nodesByColumn.forEach((nodeIds, colX) => {
        if (nodeIds.length < 2) return;
        
        nodeIds.sort((a, b) => positions.get(a)!.y - positions.get(b)!.y);
        
        for (let i = 0; i < nodeIds.length - 1; i++) {
          const id1 = nodeIds[i];
          const id2 = nodeIds[i + 1];
          
          // Skip if they're parent-child (already handled above)
          if (parent.get(id2) === id1 || parent.get(id1) === id2) continue;
          
          // Skip if they're siblings (already handled above)
          if (parent.get(id1) && parent.get(id1) === parent.get(id2)) continue;
          
          if (checkOverlap(id1, id2)) {
            hasOverlap = true;
            
            const bounds1 = getNodeBounds(id1)!;
            const bounds2 = getNodeBounds(id2)!;
            
            const neededSpace = (bounds1.y + bounds1.height + minPadding) - bounds2.y;
            
            if (neededSpace > 0) {
              // Only move id2 and its direct children
              moveNodeWithDirectChildren(id2, neededSpace + 5);
            }
          }
        }
      });
    }
    
    if (iteration >= maxIterations) {
      console.warn('Could not fully resolve all overlaps after', maxIterations, 'iterations');
    } else {
      console.log('✓ Layout完成，无遮挡 (', iteration, '次迭代)');
    }
  };
  
  // Move an entire subtree horizontally (parent and all descendants)
  const moveSubtreeHorizontally = (nodeId: string, deltaX: number): void => {
    const pos = positions.get(nodeId);
    if (pos) {
      positions.set(nodeId, { x: pos.x + deltaX, y: pos.y });
    }
    const kids = children.get(nodeId) || [];
    kids.forEach(kidId => moveSubtreeHorizontally(kidId, deltaX));
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
  
  // Position root at center
  positions.set(rootNode.id, { x: rootX, y: rootY });
  handlePositions.set(rootNode.id, { target: Position.Left, source: Position.Right });
  
  // Layout left side - children spread out from root center
  if (leftChildren.length > 0) {
    // Calculate total height needed for left children
    let leftTotalHeight = 0;
    const leftChildHeights: number[] = [];
    leftChildren.forEach((childId) => {
      const height = calcSubtreeHeight(childId);
      leftChildHeights.push(height);
      leftTotalHeight += height;
    });
    leftTotalHeight += (leftChildren.length > 1 ? (leftChildren.length - 1) * baseVerticalSpacing : 0);
    
    const nextX = rootX - horizontalSpacing;
    let currentY = rootY - leftTotalHeight / 2;
    
    leftChildren.forEach((childId, index) => {
      const kidHeight = leftChildHeights[index];
      const childCenterY = currentY + kidHeight / 2;
      initialLayout(childId, nextX, childCenterY, 'left');
      currentY += kidHeight + baseVerticalSpacing;
    });
  }
  
  // Layout right side - children spread out from root center
  if (rightChildren.length > 0) {
    // Calculate total height needed for right children
    let rightTotalHeight = 0;
    const rightChildHeights: number[] = [];
    rightChildren.forEach((childId) => {
      const height = calcSubtreeHeight(childId);
      rightChildHeights.push(height);
      rightTotalHeight += height;
    });
    rightTotalHeight += (rightChildren.length > 1 ? (rightChildren.length - 1) * baseVerticalSpacing : 0);
    
    const nextX = rootX + horizontalSpacing;
    let currentY = rootY - rightTotalHeight / 2;
    
    rightChildren.forEach((childId, index) => {
      const kidHeight = rightChildHeights[index];
      const childCenterY = currentY + kidHeight / 2;
      initialLayout(childId, nextX, childCenterY, 'right');
      currentY += kidHeight + baseVerticalSpacing;
    });
  }
  
  // Center root based on children positions (if needed)
  if (leftChildren.length > 0 || rightChildren.length > 0) {
    let minY = Infinity;
    let maxY = -Infinity;
    
    if (leftChildren.length > 0) {
      leftChildren.forEach(childId => {
        const pos = positions.get(childId)!;
        const size = getNodeSize(childId);
        minY = Math.min(minY, pos.y - size.height / 2);
        maxY = Math.max(maxY, pos.y + size.height / 2);
      });
    }
    
    if (rightChildren.length > 0) {
      rightChildren.forEach(childId => {
        const pos = positions.get(childId)!;
        const size = getNodeSize(childId);
        minY = Math.min(minY, pos.y - size.height / 2);
        maxY = Math.max(maxY, pos.y + size.height / 2);
      });
    }
    
    if (minY !== Infinity && maxY !== -Infinity) {
      const finalRootY = (minY + maxY) / 2;
      positions.set(rootNode.id, { x: rootX, y: finalRootY });
    }
  }
  
  // Resolve overlaps by adjusting node positions
  resolveOverlaps();
  
  // Extra pass: ensure that parent and direct child in the same column do not overlap horizontally.
  // 对于横向布局，子节点应该从父节点左右“伸出去”，不能压在父节点上。
  const parentChildPaddingX = 40;
  const parentChildStepX = 40;
  const maxParentChildIterations = 20;
  
  edges.forEach(edge => {
    const parentId = edge.source;
    const childId = edge.target;
    let iter = 0;
    
    while (iter < maxParentChildIterations) {
      const parentBounds = getNodeBounds(parentId);
      const childBounds = getNodeBounds(childId);
      if (!parentBounds || !childBounds) break;
      
      const overlaps = nodesOverlap(
        { x: parentBounds.x, y: parentBounds.y },
        { width: parentBounds.width, height: parentBounds.height },
        { x: childBounds.x, y: childBounds.y },
        { width: childBounds.width, height: childBounds.height },
        parentChildPaddingX
      );
      
      if (!overlaps) break;
      
      const parentCenterX = parentBounds.x + parentBounds.width / 2;
      const childCenterX = childBounds.x + childBounds.width / 2;
      const direction = childCenterX >= parentCenterX ? 1 : -1;
      
      moveSubtreeHorizontally(childId, direction * parentChildStepX);
      iter++;
    }
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
    const nodeSize = getNodeSize(node.id);
    
    return {
      ...node,
      targetPosition: handles.target,
      sourcePosition: handles.source,
      position: { x: pos.x - nodeSize.width / 2, y: pos.y - nodeSize.height / 2 },
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

  const isHorizontal = direction === 'TB' ? false : true;
  
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
    
    let sourceHandle: string | undefined = edge.sourceHandle ?? undefined;
    let targetHandle: string | undefined = edge.targetHandle ?? undefined;
    
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
