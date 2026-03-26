import React, { useRef, useCallback, useState, useEffect } from 'react';
import { getStroke } from 'perfect-freehand';
import DiagramNode from './DiagramNode';
import DiagramConnection from './DiagramConnection';
import type { DiagramData, Theme } from '../types/diagram';
import { THEME_STYLES, NODE_WIDTH, NODE_HEIGHT } from '../types/diagram';

interface StrokeData {
  points: number[][];
  color: string;
  size: number;
}

interface Props {
  data: DiagramData;
  theme: Theme;
  onNodeMove: (id: string, x: number, y: number) => void;
  onNodeClick?: (id: string) => void;
  onConnectionClick?: (from: string, to: string) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
  drawMode: 'none' | 'pencil' | 'eraser';
  activeDiagramId: string;
  strokes: StrokeData[];
  onStrokesChange: (strokes: StrokeData[]) => void;
}

function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return '';
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ['M', ...stroke[0], 'Q'] as (string | number)[]
  );
  d.push('Z');
  return d.join(' ');
}

const DiagramCanvas: React.FC<Props> = ({
  data, theme, onNodeMove, onNodeClick, onConnectionClick,
  svgRef, drawMode, strokes, onStrokesChange,
}) => {
  const dragState = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const panState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const styles = THEME_STYLES[theme];

  // Current stroke being drawn
  const [currentStroke, setCurrentStroke] = useState<number[][] | null>(null);
  const isDrawing = useRef(false);

  // Pan & zoom
  const WORLD_SIZE = { w: 7200, h: 5400 };
  const WORLD_MIN = { x: -WORLD_SIZE.w / 2, y: -WORLD_SIZE.h / 2 };
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

  // Convert screen mouse position to SVG coordinates
  const screenToSvg = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const svgP = pt.matrixTransform(ctm.inverse());
    return { x: svgP.x, y: svgP.y };
  }, [svgRef]);

  // Node drag
  const handleDragStart = useCallback((id: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const node = data.nodes.find((n) => n.id === id);
    if (!node || !svgRef.current) return;
    const svgP = screenToSvg(e);
    if (!svgP) return;
    dragState.current = { id, offsetX: svgP.x - node.x, offsetY: svgP.y - node.y };

    const handleMove = (me: MouseEvent) => {
      if (!dragState.current) return;
      const mp = screenToSvg(me);
      if (!mp) return;
      onNodeMove(dragState.current.id, mp.x - dragState.current.offsetX, mp.y - dragState.current.offsetY);
    };
    const handleUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [data.nodes, onNodeMove, svgRef, screenToSvg]);

  // Middle-mouse pan
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 1) return;
    e.preventDefault();
    panState.current = { startX: e.clientX, startY: e.clientY, originX: viewBox.x, originY: viewBox.y };
    setIsPanning(true);
    const svg = svgRef.current;
    if (!svg) return;
    const pixelToSvgX = viewBox.w / svg.clientWidth;
    const pixelToSvgY = viewBox.h / svg.clientHeight;

    const handleMove = (me: MouseEvent) => {
      if (!panState.current) return;
      const { startX, startY, originX, originY } = panState.current;
      const dx = (me.clientX - startX) * pixelToSvgX;
      const dy = (me.clientY - startY) * pixelToSvgY;
      setViewBox(prev => ({
        ...prev,
        x: Math.max(WORLD_MIN.x, Math.min(WORLD_MIN.x + WORLD_SIZE.w - prev.w, originX - dx)),
        y: Math.max(WORLD_MIN.y, Math.min(WORLD_MIN.y + WORLD_SIZE.h - prev.h, originY - dy)),
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
  }, [viewBox, svgRef, WORLD_MIN.x, WORLD_MIN.y, WORLD_SIZE.w, WORLD_SIZE.h]);

  // Scroll to zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const container = svg.parentElement;
    if (!container) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      setViewBox(prev => {
        const newW = Math.max(200, Math.min(WORLD_SIZE.w, prev.w * zoomFactor));
        const newH = Math.max(150, Math.min(WORLD_SIZE.h, prev.h * zoomFactor));
        const actualZoomX = newW / prev.w;
        const actualZoomY = newH / prev.h;
        let newX = svgP.x - (svgP.x - prev.x) * actualZoomX;
        let newY = svgP.y - (svgP.y - prev.y) * actualZoomY;
        newX = Math.max(WORLD_MIN.x, Math.min(WORLD_MIN.x + WORLD_SIZE.w - newW, newX));
        newY = Math.max(WORLD_MIN.y, Math.min(WORLD_MIN.y + WORLD_SIZE.h - newH, newY));
        return { x: newX, y: newY, w: newW, h: newH };
      });
    };
    container.addEventListener('wheel', handler, { passive: false });
    return () => container.removeEventListener('wheel', handler);
  }, [svgRef, WORLD_MIN.x, WORLD_MIN.y, WORLD_SIZE.w, WORLD_SIZE.h]);

  // Drawing handlers
  const handleDrawDown = useCallback((e: React.MouseEvent) => {
    if (drawMode === 'none') return;
    if (e.button === 1) { handleCanvasMouseDown(e); return; } // Middle = pan

    const svgP = screenToSvg(e);
    if (!svgP) return;

    if (e.button === 2 || drawMode === 'eraser') {
      // Erase: remove strokes near the click point
      e.preventDefault();
      const threshold = 15;
      const filtered = strokes.filter(stroke =>
        !stroke.points.some(([px, py]) =>
          Math.abs(px - svgP.x) < threshold && Math.abs(py - svgP.y) < threshold
        )
      );
      if (filtered.length !== strokes.length) onStrokesChange(filtered);
      return;
    }

    // Pencil: start new stroke
    if (drawMode === 'pencil' && e.button === 0) {
      e.preventDefault();
      isDrawing.current = true;
      setCurrentStroke([[svgP.x, svgP.y, 0.5]]);
    }
  }, [drawMode, screenToSvg, strokes, onStrokesChange, handleCanvasMouseDown]);

  const handleDrawMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing.current || !currentStroke) return;
    const svgP = screenToSvg(e);
    if (!svgP) return;
    setCurrentStroke(prev => prev ? [...prev, [svgP.x, svgP.y, 0.5]] : null);
  }, [currentStroke, screenToSvg]);

  const handleDrawUp = useCallback(() => {
    if (isDrawing.current && currentStroke && currentStroke.length > 1) {
      onStrokesChange([...strokes, { points: currentStroke, color: '#e0e0e0', size: 3 }]);
    }
    isDrawing.current = false;
    setCurrentStroke(null);
  }, [currentStroke, strokes, onStrokesChange]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (drawMode !== 'none') e.preventDefault();
  }, [drawMode]);

  // Render stroke paths
  const renderStroke = useCallback((stroke: StrokeData, key: number) => {
    const outline = getStroke(stroke.points, {
      size: stroke.size,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: true,
    });
    const pathData = getSvgPathFromStroke(outline);
    return <path key={key} d={pathData} fill={stroke.color} opacity="0.85" />;
  }, []);

  const gridW = Math.max(viewBox.w, 800);
  const gridH = Math.max(viewBox.h, 600);

  // Current stroke preview
  let currentStrokePath = '';
  if (currentStroke && currentStroke.length > 1) {
    const outline = getStroke(currentStroke, {
      size: 3,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: true,
    });
    currentStrokePath = getSvgPathFromStroke(outline);
  }

  const isDrawActive = drawMode !== 'none';

  return (
    <div className="canvas-panel" style={{ background: styles.surface }}>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="diagram-svg"
        style={{ cursor: isPanning ? 'grabbing' : isDrawActive ? (drawMode === 'pencil' ? 'crosshair' : 'cell') : 'default' }}
        onMouseDown={(e) => {
          if (isDrawActive) handleDrawDown(e);
          else handleCanvasMouseDown(e);
        }}
        onMouseMove={isDrawActive ? handleDrawMove : undefined}
        onMouseUp={isDrawActive ? handleDrawUp : undefined}
        onMouseLeave={isDrawActive ? handleDrawUp : undefined}
        onContextMenu={handleContextMenu}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={styles.grid} strokeWidth="0.5" opacity="0.3" />
          </pattern>
        </defs>
        <rect x={viewBox.x - 1000} y={viewBox.y - 1000} width={gridW + 2000} height={gridH + 2000} fill="url(#grid)" />

        {data.connections.map((conn, i) => (
          <DiagramConnection key={`${conn.from}-${conn.to}-${i}`} connection={conn} nodes={data.nodes} textColor={styles.text} onClick={onConnectionClick} />
        ))}

        {data.nodes.map((node) => (
          <DiagramNode key={node.id} node={node} onDragStart={handleDragStart} onClick={onNodeClick} textColor={styles.text} />
        ))}

        {/* Drawing layer — on top of nodes */}
        <g className="drawing-layer" style={{ pointerEvents: isDrawActive ? 'auto' : 'none' }}>
          {strokes.map((stroke, i) => renderStroke(stroke, i))}
          {currentStrokePath && <path d={currentStrokePath} fill="#e0e0e0" opacity="0.85" />}
        </g>
      </svg>
    </div>
  );
};

export default DiagramCanvas;
