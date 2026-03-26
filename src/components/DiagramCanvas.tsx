import React, { useRef, useCallback, useState, useEffect } from 'react';
import DiagramNode from './DiagramNode';
import DiagramConnection from './DiagramConnection';
import type { DiagramData, Theme } from '../types/diagram';
import { THEME_STYLES, NODE_WIDTH, NODE_HEIGHT } from '../types/diagram';

interface Props {
  data: DiagramData;
  theme: Theme;
  onNodeMove: (id: string, x: number, y: number) => void;
  onNodeClick?: (id: string) => void;
  onConnectionClick?: (from: string, to: string) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
  drawMode: 'none' | 'pencil' | 'eraser';
  drawCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  activeDiagramId: string;
}

const DiagramCanvas: React.FC<Props> = ({ data, theme, onNodeMove, onNodeClick, onConnectionClick, svgRef, drawMode, drawCanvasRef, activeDiagramId }) => {
  const dragState = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const panState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const isDrawing = useRef(false);
  const styles = THEME_STYLES[theme];

  // Pan & zoom state for the viewBox
  // Large world: 9 screens worth (~7200x5400 SVG units centered at origin)
  const WORLD_SIZE = { w: 7200, h: 5400 };
  const WORLD_MIN = { x: -WORLD_SIZE.w / 2, y: -WORLD_SIZE.h / 2 };

  const [viewBox, setViewBox] = useState({ x: -40, y: -40, w: 800, h: 600 });
  const [isPanning, setIsPanning] = useState(false);
  // Track the viewBox when drawing anchor was set (needed for scale)
  const drawOriginViewBox = useRef<{ w: number; h: number } | null>(null);
  // Track where the SVG anchor was in screen pixels when anchor was set
  const drawOriginAnchorScreen = useRef<{ x: number; y: number } | null>(null);
  // The SVG anchor point (viewBox center when anchor was set)
  const drawAnchorSVG = useRef<{ x: number; y: number } | null>(null);

  // Initialize anchor on mount and reset on diagram switch
  const initAnchor = useCallback(() => {
    drawOriginViewBox.current = { w: viewBox.w, h: viewBox.h };
    const anchorX = viewBox.x + viewBox.w / 2;
    const anchorY = viewBox.y + viewBox.h / 2;
    drawAnchorSVG.current = { x: anchorX, y: anchorY };
    const canvas = drawCanvasRef.current;
    const containerW = canvas?.parentElement?.clientWidth || 1;
    const containerH = canvas?.parentElement?.clientHeight || 1;
    drawOriginAnchorScreen.current = {
      x: containerW / 2,
      y: containerH / 2,
    };
  }, [viewBox, drawCanvasRef]);

  // Set anchor on mount
  useEffect(() => {
    initAnchor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset drawing anchor refs when switching diagrams
  useEffect(() => {
    // Delay slightly so viewBox has updated for the new diagram
    const t = setTimeout(() => initAnchor(), 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDiagramId]);

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
    console.log("[Canvas] Mouse down, button:", e.button);
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

    // Compute scale: SVG units per screen pixel
    const pixelToSvgX = viewBox.w / svg.clientWidth;
    const pixelToSvgY = viewBox.h / svg.clientHeight;

    const handleMove = (me: MouseEvent) => {
      if (!panState.current) return;
      const { startX, startY, originX, originY } = panState.current;
      const pixelDx = me.clientX - startX;
      const pixelDy = me.clientY - startY;
      const dx = pixelDx * pixelToSvgX;
      const dy = pixelDy * pixelToSvgY;
      setViewBox(prev => {
        const newX = Math.max(WORLD_MIN.x, Math.min(WORLD_MIN.x + WORLD_SIZE.w - prev.w, originX - dx));
        const newY = Math.max(WORLD_MIN.y, Math.min(WORLD_MIN.y + WORLD_SIZE.h - prev.h, originY - dy));
        return { ...prev, x: newX, y: newY };
      });
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

  // Scroll to zoom — use native listener to avoid passive event issue
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      setViewBox(prev => {
        // Clamp zoom: min viewBox = 200x150 (very zoomed in), max = world size
        const newW = Math.max(200, Math.min(WORLD_SIZE.w, prev.w * zoomFactor));
        const newH = Math.max(150, Math.min(WORLD_SIZE.h, prev.h * zoomFactor));
        const actualZoomX = newW / prev.w;
        const actualZoomY = newH / prev.h;
        let newX = svgP.x - (svgP.x - prev.x) * actualZoomX;
        let newY = svgP.y - (svgP.y - prev.y) * actualZoomY;
        // Clamp pan
        newX = Math.max(WORLD_MIN.x, Math.min(WORLD_MIN.x + WORLD_SIZE.w - newW, newX));
        newY = Math.max(WORLD_MIN.y, Math.min(WORLD_MIN.y + WORLD_SIZE.h - newH, newY));
        return { x: newX, y: newY, w: newW, h: newH };
      });
    };
    // Attach to the canvas-panel container so it works regardless of draw mode
    const container = svg.parentElement;
    if (container) {
      container.addEventListener('wheel', handler, { passive: false });
      return () => container.removeEventListener('wheel', handler);
    }
  }, [svgRef]);

  // Resize drawing canvas to match container
  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(() => {
      const oldData = canvas.toDataURL();
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(img, 0, 0);
        }
      };
      img.src = oldData;
    });
    observer.observe(parent);
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    return () => observer.disconnect();
  }, []);

  // Convert mouse screen position to untransformed canvas pixel coords
  const screenToCanvas = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    // rect is the transformed bounding box; scale mouse pos by canvas/rect ratio
    const x = (e.clientX - rect.left) / rect.width * canvas.width;
    const y = (e.clientY - rect.top) / rect.height * canvas.height;
    return { x, y };
  }, [drawCanvasRef]);

  const handleDrawStart = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Middle mouse → pan (let it pass through to SVG)
    if (e.button === 1) return;
    // Right click → always erase
    // Left click → pencil (only in pencil mode)
    const isErasing = e.button === 2;
    if (!isErasing && drawMode !== 'pencil') return;

    e.preventDefault();
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    isDrawing.current = true;
    const { x, y } = screenToCanvas(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (isErasing) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 2;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [drawMode, viewBox, screenToCanvas]);

  const handleDrawMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = screenToCanvas(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [screenToCanvas]);

  const handleDrawEnd = useCallback(() => {
    isDrawing.current = false;
  }, []);

  const handleDrawContextMenu = useCallback((e: React.MouseEvent) => {
    // Prevent context menu when in draw mode
    if (drawMode !== 'none') e.preventDefault();
  }, [drawMode]);

  // Grid size
  const gridW = Math.max(viewBox.w, 800);
  const gridH = Math.max(viewBox.h, 600);

  // Compute CSS transform for drawing canvas using anchor alignment
  let canvasTransform = '';
  let canvasTransformOrigin = '0 0';
  if (drawOriginViewBox.current && drawAnchorSVG.current && drawOriginAnchorScreen.current) {
    const canvas = drawCanvasRef.current;
    const containerW = canvas?.parentElement?.clientWidth || 1;
    const containerH = canvas?.parentElement?.clientHeight || 1;

    // Compute anchor's current screen position from viewBox math (no DOM query = no frame lag)
    const currentAnchorX = (drawAnchorSVG.current.x - viewBox.x) / viewBox.w * containerW;
    const currentAnchorY = (drawAnchorSVG.current.y - viewBox.y) / viewBox.h * containerH;

    // Translation = how much the anchor moved in screen pixels
    const translateX = currentAnchorX - drawOriginAnchorScreen.current.x;
    const translateY = currentAnchorY - drawOriginAnchorScreen.current.y;

    // Scale = ratio of original to current viewBox size
    const scaleX = drawOriginViewBox.current.w / viewBox.w;
    const scaleY = drawOriginViewBox.current.h / viewBox.h;

    // Scale around the anchor's ORIGINAL screen position, then translate
    canvasTransformOrigin = `${drawOriginAnchorScreen.current.x}px ${drawOriginAnchorScreen.current.y}px`;
    canvasTransform = `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;
  }

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
      </svg>
      <canvas
        ref={drawCanvasRef}
        className="draw-overlay"
        style={{
          pointerEvents: drawMode !== 'none' ? 'auto' : 'none',
          cursor: drawMode === 'pencil' ? 'crosshair' : drawMode === 'eraser' ? 'cell' : undefined,
          transform: canvasTransform || undefined,
          transformOrigin: canvasTransformOrigin,
        }}
        onMouseDown={(e) => {
          if (e.button === 1) {
            // Middle click → pass through to SVG for panning
            handleCanvasMouseDown(e as unknown as React.MouseEvent);
          } else {
            handleDrawStart(e);
          }
        }}
        onMouseMove={handleDrawMove}
        onMouseUp={handleDrawEnd}
        onMouseLeave={handleDrawEnd}
        onContextMenu={handleDrawContextMenu}
      />
    </div>
  );
};

export default DiagramCanvas;
