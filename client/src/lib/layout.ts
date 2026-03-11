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

  // Radial layout tuning (compact but avoids obvious overlaps).
  const baseRadius = 240;
  const radiusIncrement = 180;
  const minAngleSpacing = 0.22; // Minimum angle between siblings (in radians)

  const getNodeSize = (nodeId: string): { width: number; height: number } => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { width: nodeWidth, height: nodeHeight };
    return {
      width: node.measured?.width ?? nodeWidth,
      height: node.measured?.height ?? nodeHeight
    };
  };

  // Subtree weight (leaf-count-ish) for allocating angular space to heavy branches.
  const subtreeWeight = new Map<string, number>();
  const getWeight = (nodeId: string): number => {
    const cached = subtreeWeight.get(nodeId);
    if (cached !== undefined) return cached;
    const nodeChildren = children.get(nodeId) || [];
    if (nodeChildren.length === 0) {
      subtreeWeight.set(nodeId, 1);
      return 1;
    }
    let sum = 0;
    nodeChildren.forEach((childId) => {
      sum += getWeight(childId);
    });
    subtreeWeight.set(nodeId, sum);
    return sum;
  };
  roots.forEach((r) => getWeight(r.id));

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
      const minRequiredRadius = parentHalfDiagonal + maxChildHalfDiagonal + 50; // extra padding
      if (radius < minRequiredRadius) {
        radius = minRequiredRadius;
      }

      const parentPos = positions.get(parentId)!;
      const childAngles: number[] = [];

      // Allocate angle span by subtree weight for a more balanced radial layout.
      const availableAngle = endAngle - startAngle;
      const totalWeight = nodeChildren.reduce((acc, id) => acc + getWeight(id), 0);

      let spans = nodeChildren.map((id) => {
        const w = getWeight(id);
        return (w / Math.max(totalWeight, 1)) * availableAngle;
      });

      // Enforce a minimum angular separation, but fall back to equal spacing if impossible.
      spans = spans.map((s) => Math.max(s, minAngleSpacing));
      const spanSum = spans.reduce((acc, s) => acc + s, 0);
      if (spanSum > availableAngle) {
        spans = nodeChildren.map(() => availableAngle / nodeChildren.length);
      }

      // Ensure radius is large enough to fit siblings along the arc without overlap.
      const totalChildWidth = nodeChildren.reduce((acc, id) => acc + getNodeSize(id).width, 0);
      const minRadiusForArc = availableAngle > 0
        ? (totalChildWidth + 26 * Math.max(0, nodeChildren.length - 1)) / availableAngle
        : 0;
      if (radius < minRadiusForArc) {
        radius = minRadiusForArc;
      }

      let cursor = startAngle;
      nodeChildren.forEach((childId, index) => {
        const span = spans[index] ?? (availableAngle / nodeChildren.length);
        const angle = cursor + span / 2;
        cursor += span;
        childAngles.push(angle);
        const x = parentPos.x + Math.cos(angle) * radius;
        const y = parentPos.y + Math.sin(angle) * radius;
        positions.set(childId, { x, y });
        
        const angleToParent = Math.atan2(parentPos.y - y, parentPos.x - x);
        const handles = getHandlePositionFromAngle(angleToParent);
        handlePositions.set(childId, handles);
        
        // Recurse inside child's span with a small margin to reduce overlap between subtrees.
        const childAngleSpan = Math.min(span * 0.9, availableAngle / nodeChildren.length);
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
  // This post-pass tends to distort the radial shape and create very long edges.
  // Keep it disabled; radius/angle allocation already avoids most overlaps.
  const maxParentChildIterations = 0;

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
  const verticalSplitLayout = (allNodes: Node[], allEdges: Edge[]) => {
    if (allNodes.length === 0) return { nodes: allNodes, edges: allEdges };

    // Root = node with no incoming edge (fallback to first node)
    const targetIds = new Set(allEdges.map(e => e.target));
    const rootNodes = allNodes.filter(n => !targetIds.has(n.id));
    const rootNode = rootNodes.length > 0 ? rootNodes[0] : allNodes[0];
    if (!rootNode) return { nodes: allNodes, edges: allEdges };

    const rootCenterX = rootNode.position.x + (rootNode.measured?.width ?? nodeWidth) / 2;
    const rootCenterY = rootNode.position.y + (rootNode.measured?.height ?? nodeHeight) / 2;

    const childrenBySource = new Map<string, Edge[]>();
    allEdges.forEach(e => {
      const list = childrenBySource.get(e.source) ?? [];
      list.push(e);
      childrenBySource.set(e.source, list);
    });

    type Side = 'top' | 'bottom';
    const sideById = new Map<string, Side>();

    const sideFromHandle = (h?: string | null): Side | null => {
      if (h === 'top') return 'top';
      if (h === 'bottom') return 'bottom';
      // When switching from horizontal -> vertical, map left/right into top/bottom.
      if (h === 'left') return 'top';
      if (h === 'right') return 'bottom';
      return null;
    };

    const decideRootChildSide = (edge: Edge, index: number, siblingCount: number): Side => {
      const fromHandle = sideFromHandle(edge.sourceHandle);
      if (fromHandle) return fromHandle;

      const target = allNodes.find(n => n.id === edge.target);
      if (target) {
        const targetCenterY = target.position.y + (target.measured?.height ?? nodeHeight) / 2;
        const targetCenterX = target.position.x + (target.measured?.width ?? nodeWidth) / 2;
        if (Math.abs(targetCenterY - rootCenterY) > 20) {
          return targetCenterY < rootCenterY ? 'top' : 'bottom';
        }
        // If Y is ambiguous (typical after LR), use X split: left -> top, right -> bottom.
        return targetCenterX < rootCenterX ? 'top' : 'bottom';
      }

      // Last resort: alternate to keep tree balanced.
      return index < Math.ceil(siblingCount / 2) ? 'top' : 'bottom';
    };

    // Assign sides via BFS from root, inheriting parent's side unless edge explicitly overrides.
    const rootEdges = childrenBySource.get(rootNode.id) ?? [];
    rootEdges.forEach((e, idx) => {
      sideById.set(e.target, decideRootChildSide(e, idx, rootEdges.length));
    });

    const queue: string[] = [...rootEdges.map(e => e.target)];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const parentSide = sideById.get(nodeId);
      const out = childrenBySource.get(nodeId) ?? [];

      out.forEach(e => {
        const explicit = sideFromHandle(e.sourceHandle);
        const nextSide: Side = explicit ?? parentSide ?? 'bottom';
        if (!sideById.has(e.target)) {
          sideById.set(e.target, nextSide);
          queue.push(e.target);
        }
      });
    }

    const runDagre = (subNodeIds: Set<string>, rankdir: 'TB' | 'BT') => {
      const g = new dagre.graphlib.Graph();
      g.setDefaultEdgeLabel(() => ({}));
      g.setGraph({
        rankdir,
        // Vertical mindmap needs generous cross-axis spacing to avoid overlaps for wide nodes.
        nodesep: 180,
        ranksep: 240,
        marginx: 140,
        marginy: 140,
        // Trees benefit from tight-tree; network-simplex often packs too tightly for mixed node sizes.
        ranker: 'tight-tree'
      });

      allNodes.forEach(n => {
        if (!subNodeIds.has(n.id)) return;
        g.setNode(n.id, {
          width: n.measured?.width ?? nodeWidth,
          height: n.measured?.height ?? nodeHeight
        });
      });

      allEdges.forEach(e => {
        if (!subNodeIds.has(e.source) || !subNodeIds.has(e.target)) return;
        // minlen increases distance between ranks a bit to reduce edge overlaps.
        g.setEdge(e.source, e.target, { weight: 2, minlen: 1 });
      });

      dagre.layout(g);

      const posById = new Map<string, { x: number; y: number }>();
      subNodeIds.forEach(id => {
        const p = g.node(id);
        const n = allNodes.find(nn => nn.id === id);
        if (!p || !n) return;
        const w = n.measured?.width ?? nodeWidth;
        const h = n.measured?.height ?? nodeHeight;
        posById.set(id, { x: p.x - w / 2, y: p.y - h / 2 });
      });

      return posById;
    };

    const topIds = new Set<string>([rootNode.id]);
    const bottomIds = new Set<string>([rootNode.id]);
    allNodes.forEach(n => {
      const side = sideById.get(n.id);
      if (side === 'top') topIds.add(n.id);
      else if (side === 'bottom') bottomIds.add(n.id);
    });

    // Ensure every non-root node belongs to some side.
    allNodes.forEach(n => {
      if (n.id === rootNode.id) return;
      if (!topIds.has(n.id) && !bottomIds.has(n.id)) bottomIds.add(n.id);
    });

    const topPos = runDagre(topIds, 'BT');
    const bottomPos = runDagre(bottomIds, 'TB');

    // Align both sub-layouts' root to the existing root position to avoid jumping the viewport.
    const rootGlobal = { x: rootNode.position.x, y: rootNode.position.y };
    const topRoot = topPos.get(rootNode.id) ?? rootGlobal;
    const bottomRoot = bottomPos.get(rootNode.id) ?? rootGlobal;
    const topOffset = { x: rootGlobal.x - topRoot.x, y: rootGlobal.y - topRoot.y };
    const bottomOffset = { x: rootGlobal.x - bottomRoot.x, y: rootGlobal.y - bottomRoot.y };

    const getNodeSide = (id: string): Side => sideById.get(id) ?? 'bottom';

    const newNodes = allNodes.map(n => {
      if (n.id === rootNode.id) {
        return {
          ...n,
          position: rootGlobal,
          targetPosition: Position.Top,
          sourcePosition: Position.Bottom
        };
      }

      const side = getNodeSide(n.id);
      const base = side === 'top' ? topPos.get(n.id) : bottomPos.get(n.id);
      const offset = side === 'top' ? topOffset : bottomOffset;
      const finalPos = base
        ? { x: base.x + offset.x, y: base.y + offset.y }
        : n.position;

      return {
        ...n,
        position: finalPos,
        targetPosition: side === 'top' ? Position.Bottom : Position.Top,
        sourcePosition: side === 'top' ? Position.Top : Position.Bottom
      };
    });

    const newEdges = allEdges.map(e => {
      const targetSide = getNodeSide(e.target);
      const sourceSide = e.source === rootNode.id ? targetSide : getNodeSide(e.source);

      const sourceHandle =
        e.source === rootNode.id
          ? (targetSide === 'top' ? 'top' : 'bottom')
          : (sourceSide === 'top' ? 'top' : 'bottom');

      const targetHandle = targetSide === 'top' ? 'bottom' : 'top';

      return {
        ...e,
        sourceHandle,
        targetHandle
      };
    });

    return { nodes: newNodes, edges: newEdges };
  };

  if (direction === 'radial') {
    const layoutedNodes = radialLayout(nodes, edges);
    const nodeById = new Map(layoutedNodes.map((n) => [n.id, n]));

    const getCenter = (n: Node) => {
      const w = (n.measured?.width ?? (n.data?.width as number) ?? nodeWidth) as number;
      const h = (n.measured?.height ?? (n.data?.height as number) ?? nodeHeight) as number;
      return { x: n.position.x + w / 2, y: n.position.y + h / 2 };
    };

    const vectorToHandle = (dx: number, dy: number) => {
      if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
      return dy >= 0 ? 'bottom' : 'top';
    };

    const opposite = (h: string) => {
      if (h === 'left') return 'right';
      if (h === 'right') return 'left';
      if (h === 'top') return 'bottom';
      return 'top';
    };

    const layoutedEdges = edges.map((e) => {
      const src = nodeById.get(e.source);
      const tgt = nodeById.get(e.target);
      if (!src || !tgt) return e;
      const sc = getCenter(src);
      const tc = getCenter(tgt);
      const dx = tc.x - sc.x;
      const dy = tc.y - sc.y;
      const sh = vectorToHandle(dx, dy);
      const th = opposite(sh);
      return { ...e, sourceHandle: sh, targetHandle: th };
    });

    return { nodes: layoutedNodes, edges: layoutedEdges };
  }
  
  // Use horizontal layout for LR direction
  if (direction === 'LR') {
    return horizontalLayout(nodes, edges);
  }

  // Vertical split layout (top and bottom subtrees) to avoid overlap/crossing.
  return verticalSplitLayout(nodes, edges);
};
