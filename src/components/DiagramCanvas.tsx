import React, { useRef, useCallback, useState, useEffect } from 'react';
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
  const panState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const styles = THEME_STYLES[theme];

  // Pan & zoom state for the viewBox
  const [viewBox, setViewBox] = useState({ x: -40, y: -40, w: 800, h: 600 });
  const [isPanning, setIsPanning] = useState(false);

  // Refit viewBox when nodes change significantly
  const prevNodeCount = useRef(0);
  useEffect(() => {
    if (data.nodes.length !== prevNodeCount.current) {
      prevNodeCount.current = data.nodes.length;
      if (data.nodes.length > 0) {
        const padding = 60;
        const minX = Math.min(...data.nodes.map(n => n.x)) - padding;
        const minY = Math.min(...data.nodes.map(n => n.y)) - padding;
        const maxX = Math.max(...data.nodes.map(n => n.x + NODE_WIDTH)) + padding;
        const maxY = Math.max(...data.nodes.map(n => n.y + NODE_HEIGHT)) + padding;
        setViewBox({ x: minX, y: minY, w: Math.max(maxX - minX, 800), h: Math.max(maxY - minY, 600) });
      }
    }
  }, [data.nodes]);

  const handleDragStart = useCallback((id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click for node drag
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

  // Middle-mouse pan on the canvas background
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 1) return; // Middle mouse only
    e.preventDefault();
    panState.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: viewBox.x,
      originY: viewBox.y,
    };
    setIsPanning(true);

    const svg = svgRef.current;
    if (!svg) return;

    // Compute scale: how many SVG units per screen pixel
    const ctm = svg.getScreenCTM();
    const scaleX = ctm ? viewBox.w / (ctm.a * svg.clientWidth / ctm.a) : 1;
    const scaleY = ctm ? viewBox.h / (ctm.d * svg.clientHeight / ctm.d) : 1;
    const pixelToSvgX = viewBox.w / svg.clientWidth;
    const pixelToSvgY = viewBox.h / svg.clientHeight;

    const handleMove = (me: MouseEvent) => {
      if (!panState.current) return;
      const dx = (me.clientX - panState.current.startX) * pixelToSvgX;
      const dy = (me.clientY - panState.current.startY) * pixelToSvgY;
      setViewBox(prev => ({
        ...prev,
        x: panState.current!.originX - dx,
        y: panState.current!.originY - dy,
      }));
    };

    const handleUp = () => {
      panState.current = null;
      setIsPanning(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [viewBox, svgRef]);

  // Scroll to zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;

    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;

    // Get mouse position in SVG coords
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());

    setViewBox(prev => {
      const newW = prev.w * zoomFactor;
      const newH = prev.h * zoomFactor;
      // Zoom toward mouse position
      const newX = svgP.x - (svgP.x - prev.x) * zoomFactor;
      const newY = svgP.y - (svgP.y - prev.y) * zoomFactor;
      return { x: newX, y: newY, w: newW, h: newH };
    });
  }, [svgRef]);

  // Grid size
  const gridW = Math.max(viewBox.w, 800);
  const gridH = Math.max(viewBox.h, 600);

  return (
    <div className="canvas-panel" style={{ background: styles.surface }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="diagram-svg"
        style={{ cursor: isPanning ? 'grabbing' : 'default' }}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={styles.grid} strokeWidth="0.5" opacity="0.3" />
          </pattern>
        </defs>
        <rect x={viewBox.x - 1000} y={viewBox.y - 1000} width={gridW + 2000} height={gridH + 2000} fill="url(#grid)" />

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
