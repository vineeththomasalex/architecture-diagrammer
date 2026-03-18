import React, { useRef, useCallback } from 'react';
import DiagramNode from './DiagramNode';
import DiagramConnection from './DiagramConnection';
import type { DiagramData, Theme } from '../types/diagram';
import { THEME_STYLES, NODE_WIDTH, NODE_HEIGHT } from '../types/diagram';

interface Props {
  data: DiagramData;
  theme: Theme;
  onNodeMove: (id: string, x: number, y: number) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

const DiagramCanvas: React.FC<Props> = ({ data, theme, onNodeMove, svgRef }) => {
  const dragState = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const styles = THEME_STYLES[theme];

  const handleDragStart = useCallback((id: string, e: React.MouseEvent) => {
    e.preventDefault();
    const node = data.nodes.find((n) => n.id === id);
    if (!node || !svgRef.current) return;

    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());

    dragState.current = { id, offsetX: svgP.x - node.x, offsetY: svgP.y - node.y };

    const handleMove = (me: MouseEvent) => {
      if (!dragState.current) return;
      const mp = svg.createSVGPoint();
      mp.x = me.clientX;
      mp.y = me.clientY;
      const mvp = mp.matrixTransform(svg.getScreenCTM()!.inverse());
      onNodeMove(
        dragState.current.id,
        mvp.x - dragState.current.offsetX,
        mvp.y - dragState.current.offsetY
      );
    };

    const handleUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [data.nodes, onNodeMove, svgRef]);

  // Compute viewBox to fit all nodes with padding
  const padding = 40;
  let minX = 0, minY = 0, maxX = 800, maxY = 600;
  if (data.nodes.length > 0) {
    minX = Math.min(...data.nodes.map(n => n.x)) - padding;
    minY = Math.min(...data.nodes.map(n => n.y)) - padding;
    maxX = Math.max(...data.nodes.map(n => n.x + NODE_WIDTH)) + padding;
    maxY = Math.max(...data.nodes.map(n => n.y + NODE_HEIGHT)) + padding;
  }

  return (
    <div className="canvas-panel" style={{ background: styles.surface }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${minX} ${minY} ${Math.max(maxX - minX, 800)} ${Math.max(maxY - minY, 600)}`}
        preserveAspectRatio="xMidYMid meet"
        className="diagram-svg"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={styles.text} opacity="0.6" />
          </marker>
        </defs>

        {/* Grid pattern */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={styles.grid} strokeWidth="0.5" opacity="0.3" />
          </pattern>
        </defs>
        <rect x={minX} y={minY} width={Math.max(maxX - minX, 800)} height={Math.max(maxY - minY, 600)} fill="url(#grid)" />

        {data.connections.map((conn, i) => (
          <DiagramConnection key={`${conn.from}-${conn.to}-${i}`} connection={conn} nodes={data.nodes} textColor={styles.text} />
        ))}

        {data.nodes.map((node) => (
          <DiagramNode key={node.id} node={node} onDragStart={handleDragStart} textColor={styles.text} />
        ))}
      </svg>
    </div>
  );
};

export default DiagramCanvas;
