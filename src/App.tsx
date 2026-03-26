import { useState, useRef, useCallback, useEffect } from 'react';
import YamlEditor from './components/YamlEditor';
import DiagramCanvas from './components/DiagramCanvas';
import Toolbar from './components/Toolbar';
import { parseYaml } from './utils/yamlParser';
import { gridLayout, forceLayout, tieredLayout } from './utils/layoutEngine';
import { exportSvgToFile, copyYamlToClipboard } from './utils/exportSvg';
import type { DiagramData, Theme, NodeType, ConnectionType } from './types/diagram';
import { DEFAULT_YAML } from './types/diagram';
import './App.css';

interface SavedDiagram {
  id: string;
  name: string;
  yaml: string;
  notes: string;
  lastModified: number;
  positions?: Record<string, { x: number; y: number }>;
  drawingData?: string;
}

const STORAGE_KEY = 'sysdesign-diagrams';
const ACTIVE_KEY = 'sysdesign-active';

function loadDiagrams(): SavedDiagram[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveDiagrams(diagrams: SavedDiagram[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(diagrams));
}

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function App() {
  const [diagrams, setDiagrams] = useState<SavedDiagram[]>(() => {
    const saved = loadDiagrams();
    if (saved.length > 0) return saved;
    return [{ id: newId(), name: 'Netflix Design', yaml: DEFAULT_YAML, notes: '', lastModified: Date.now() }];
  });

  const [activeId, setActiveId] = useState<string>(() => {
    const saved = localStorage.getItem(ACTIVE_KEY);
    const ids = loadDiagrams().map((d) => d.id);
    if (saved && ids.includes(saved)) return saved;
    return diagrams[0].id;
  });

  const activeDiagram = diagrams.find((d) => d.id === activeId) || diagrams[0];
  const yaml = activeDiagram.yaml;
  const notes = activeDiagram.notes || '';

  const [diagram, setDiagram] = useState<DiagramData>({ nodes: [], connections: [] });
  const [parseError, setParseError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [highlightLines, setHighlightLines] = useState<{ start: number; end: number } | null>(null);
  const [flashLines, setFlashLines] = useState<{ start: number; end: number } | null>(null);
  const [editorTab, setEditorTab] = useState<'yaml' | 'notes'>('yaml');
  const [drawMode, setDrawMode] = useState<'none' | 'pencil' | 'eraser'>('none');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const initialLayoutDone = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist active tab
  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);

  // Restore drawing when switching diagrams
  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Reset composite mode and clear
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Restore saved drawing if any
    const savedDrawing = activeDiagram.drawingData;
    if (savedDrawing) {
      const img = new Image();
      img.onload = () => {
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(img, 0, 0);
      };
      img.src = savedDrawing;
    }
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-save
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDiagrams(diagrams);
    }, 400);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [diagrams]);

  // Parse YAML whenever it changes
  useEffect(() => {
    const { data, error } = parseYaml(yaml);
    setParseError(error);
    if (data) {
      setDiagram((prev) => {
        // Use saved positions from the diagram if available (tab switch), else from prev state
        const savedPositions = activeDiagram.positions || {};
        const posMap = new Map<string, { x: number; y: number }>();
        // Prefer saved positions (from tab switch), then current state
        prev.nodes.forEach(n => posMap.set(n.id, { x: n.x, y: n.y }));
        Object.entries(savedPositions).forEach(([id, pos]) => posMap.set(id, pos));

        const hasNewNodes = data.nodes.some((n) => !posMap.has(n.id));

        let nodes = data.nodes.map((n) => {
          const existing = posMap.get(n.id);
          return existing ? { ...n, x: existing.x, y: existing.y } : n;
        });

        if (!initialLayoutDone.current) {
          // First load or tab switch — use saved positions if we have them, otherwise do layout
          if (Object.keys(savedPositions).length > 0) {
            // We already applied saved positions above
          } else {
            nodes = forceLayout(nodes, data.connections, 800, 600);
          }
          initialLayoutDone.current = true;
        } else if (hasNewNodes) {
          const existingNodes = nodes.filter((n) => posMap.has(n.id));
          const avgX = existingNodes.length > 0
            ? existingNodes.reduce((s, n) => s + n.x, 0) / existingNodes.length
            : 400;
          const avgY = existingNodes.length > 0
            ? existingNodes.reduce((s, n) => s + n.y, 0) / existingNodes.length
            : 300;
          nodes = nodes.map((n) =>
            n.x === 0 && n.y === 0 && !posMap.has(n.id)
              ? { ...n, x: avgX + (Math.random() - 0.5) * 200, y: avgY + (Math.random() - 0.5) * 150 }
              : n
          );
        }

        return { nodes, connections: data.connections };
      });
    }
  }, [yaml]);

  const setYaml = useCallback((newYaml: string) => {
    console.log("[App] YAML updated, length:", newYaml.length);
    setDiagrams((prev) =>
      prev.map((d) =>
        d.id === activeId ? { ...d, yaml: newYaml, lastModified: Date.now() } : d
      )
    );
  }, [activeId]);

  const setNotes = useCallback((newNotes: string) => {
    setDiagrams((prev) =>
      prev.map((d) =>
        d.id === activeId ? { ...d, notes: newNotes, lastModified: Date.now() } : d
      )
    );
  }, [activeId]);

  const handleNewDiagram = useCallback(() => {
    const id = newId();
    setDiagrams((prev) => {
      const name = `Diagram ${prev.length + 1}`;
      return [...prev, { id, name, yaml: DEFAULT_YAML, notes: '', lastModified: Date.now() }];
    });
    setActiveId(id);
    initialLayoutDone.current = false;
  }, []);

  const handleDeleteDiagram = useCallback((id: string) => {
    setDiagrams((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((d) => d.id !== id);
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
    initialLayoutDone.current = false;
  }, [activeId]);

  // Save current diagram's positions and drawing before switching
  const saveCurrentDiagramState = useCallback(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    diagram.nodes.forEach(n => { positions[n.id] = { x: n.x, y: n.y }; });
    const drawingData = drawCanvasRef.current?.toDataURL() || undefined;
    setDiagrams(prev => prev.map(d =>
      d.id === activeId ? { ...d, positions, drawingData } : d
    ));
  }, [activeId, diagram.nodes]);

  const handleSelectTab = useCallback((id: string) => {
    if (id === activeId) return;
    saveCurrentDiagramState();
    setActiveId(id);
    initialLayoutDone.current = false;
  }, [activeId, saveCurrentDiagramState]);

  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleStartRename = useCallback((id: string, currentName: string) => {
    setRenamingTabId(id);
    setRenameValue(currentName);
  }, []);

  const handleFinishRename = useCallback(() => {
    if (renamingTabId && renameValue.trim()) {
      setDiagrams((prev) =>
        prev.map((d) =>
          d.id === renamingTabId ? { ...d, name: renameValue.trim() } : d
        )
      );
    }
    setRenamingTabId(null);
  }, [renamingTabId, renameValue]);

  const handleNodeMove = useCallback((id: string, x: number, y: number) => {
    console.log("[App] Node moved:", id, x.toFixed(0), y.toFixed(0));
    setDiagram((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    }));
  }, []);

  const handleAutoLayout = useCallback((mode: 'grid' | 'force' | 'tiered') => {
    setDiagram((prev) => {
      let nodes: typeof prev.nodes;
      switch (mode) {
        case 'grid':
          nodes = gridLayout(prev.nodes, 800);
          break;
        case 'tiered':
          nodes = tieredLayout(prev.nodes, 800);
          break;
        case 'force':
        default:
          nodes = forceLayout(prev.nodes, prev.connections, 800, 600);
          break;
      }
      return { ...prev, nodes };
    });
  }, []);

  const handleExportSvg = useCallback(() => {
    if (svgRef.current) exportSvgToFile(svgRef.current);
  }, []);

  const handleCopyYaml = useCallback(() => {
    copyYamlToClipboard(yaml).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  }, [yaml]);

  // Find YAML line range for a node by id
  const findNodeLines = useCallback((nodeId: string): { start: number; end: number } | null => {
    const lines = yaml.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.match(new RegExp(`^-?\\s*id:\\s*${nodeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`))) {
        // Found the id line, now find the block boundaries
        // Walk backward to find the "- id:" start if id is not on the dash line
        let blockStart = i;
        for (let j = i - 1; j >= 0; j--) {
          if (lines[j].trim().startsWith('- ')) { blockStart = j; break; }
          if (!lines[j].trim().startsWith('') || lines[j].trim() === '' || lines[j].trim().startsWith('nodes:') || lines[j].trim().startsWith('connections:')) break;
        }
        if (lines[i].trim().startsWith('- ')) blockStart = i;
        // Walk forward to find block end
        let blockEnd = blockStart;
        for (let j = blockStart + 1; j < lines.length; j++) {
          const t = lines[j].trim();
          if (t === '' || t.startsWith('- ') || t === 'nodes:' || t === 'connections:') break;
          blockEnd = j;
        }
        return { start: blockStart, end: blockEnd };
      }
    }
    return null;
  }, [yaml]);

  // Find YAML line range for a connection by from/to
  const findConnectionLines = useCallback((from: string, to: string): { start: number; end: number } | null => {
    const lines = yaml.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.match(new RegExp(`^-?\\s*from:\\s*${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`))) {
        // Check if next few lines have matching "to:"
        for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
          if (lines[j].trim().match(new RegExp(`^to:\\s*${to.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`))) {
            let blockStart = i;
            if (lines[i].trim().startsWith('- ')) blockStart = i;
            else {
              for (let k = i - 1; k >= 0; k--) {
                if (lines[k].trim().startsWith('- ')) { blockStart = k; break; }
                if (lines[k].trim() === '' || lines[k].trim().startsWith('connections:')) break;
              }
            }
            let blockEnd = j;
            for (let k = j + 1; k < lines.length; k++) {
              const t = lines[k].trim();
              if (t === '' || t.startsWith('- ') || t === 'nodes:' || t === 'connections:') break;
              blockEnd = k;
            }
            return { start: blockStart, end: blockEnd };
          }
        }
      }
    }
    return null;
  }, [yaml]);

  const handleNodeClick = useCallback((id: string) => {
    console.log("[App] Node clicked:", id);
    const range = findNodeLines(id);
    setHighlightLines(range);
  }, [findNodeLines]);

  const handleConnectionClick = useCallback((from: string, to: string) => {
    console.log("[App] Connection clicked:", from, "→", to);
    const range = findConnectionLines(from, to);
    setHighlightLines(range);
  }, [findConnectionLines]);

  const handleAddNode = useCallback((type: NodeType) => {
    const lines = yaml.split('\n');
    // Find the "connections:" line
    let connectionsIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === 'connections:') {
        connectionsIdx = i;
        break;
      }
    }
    const newId = `${type}${Date.now().toString(36).slice(-4)}`;
    const nodeLines = [
      `  - id: ${newId}`,
      `    label: New ${type}`,
      `    type: ${type}`,
    ];

    if (connectionsIdx >= 0) {
      // Insert before connections: with a blank line separator
      // Check if there's already a blank line before connections:
      const hasBlankBefore = connectionsIdx > 0 && lines[connectionsIdx - 1].trim() === '';
      const insertAt = hasBlankBefore ? connectionsIdx - 1 : connectionsIdx;
      const toInsert = hasBlankBefore
        ? [...nodeLines, '']
        : ['', ...nodeLines, ''];
      lines.splice(insertAt, 0, ...toInsert);
    } else {
      // No connections section — just append
      lines.push('', ...nodeLines);
    }

    const newYaml = lines.join('\n');
    setYaml(newYaml);
    // Flash the new lines
    const newLines = newYaml.split('\n');
    const startLine = newLines.findIndex(l => l.includes(`id: ${newId}`));
    if (startLine >= 0) {
      setFlashLines({ start: startLine, end: startLine + 2 });
    }
  }, [yaml, setYaml]);

  const handleAddConnection = useCallback((type: ConnectionType) => {
    const lines = yaml.split('\n');
    // Remove trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
    // Add blank line separator + new connection entry
    const insertStart = lines.length + 1; // after the blank line
    const connLines = [
      '',
      `  - from: source`,
      `    to: target`,
      `    label: connection`,
      `    type: ${type}`,
    ];
    lines.push(...connLines, '');
    const newYaml = lines.join('\n');
    setYaml(newYaml);
    // Flash the newly added lines (skip the blank line, flash the 4 content lines)
    setFlashLines({ start: insertStart, end: insertStart + 3 });
  }, [yaml, setYaml]);

  return (
    <div className={`app-container theme-${theme}`}>
      <header className="app-header">
        <h1>System Design Diagrammer 📐</h1>
        <Toolbar
          theme={theme}
          onThemeChange={setTheme}
          onAutoLayout={handleAutoLayout}
          onExportSvg={handleExportSvg}
          onCopyYaml={handleCopyYaml}
        />
      </header>
      <div className="tab-bar">
        {diagrams.map((d) => (
          <div
            key={d.id}
            className={`tab ${d.id === activeId ? 'tab-active' : ''}`}
            onClick={() => handleSelectTab(d.id)}
            onDoubleClick={(e) => { e.stopPropagation(); handleStartRename(d.id, d.name); }}
          >
            {renamingTabId === d.id ? (
              <input
                className="tab-rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleFinishRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFinishRename();
                  if (e.key === 'Escape') setRenamingTabId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="tab-name">{d.name}</span>
            )}
            {diagrams.length > 1 && renamingTabId !== d.id && (
              <button
                className="tab-close"
                onClick={(e) => { e.stopPropagation(); handleDeleteDiagram(d.id); }}
                title="Close tab"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button className="tab-add" onClick={handleNewDiagram} title="New diagram">
          +
        </button>
        <div className="tab-bar-spacer" />
        <div className="draw-tools">
          <button
            className={`draw-btn ${drawMode === 'pencil' ? 'draw-btn-active' : ''}`}
            onClick={() => setDrawMode(drawMode === 'pencil' ? 'none' : 'pencil')}
            title="Draw (pencil)"
          >
            ✏️
          </button>
          <button
            className={`draw-btn ${drawMode === 'eraser' ? 'draw-btn-active' : ''}`}
            onClick={() => setDrawMode(drawMode === 'eraser' ? 'none' : 'eraser')}
            title="Erase drawing"
          >
            🧹
          </button>
          <button
            className="draw-btn"
            onClick={() => {
              const canvas = drawCanvasRef.current;
              if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.globalCompositeOperation = 'source-over';
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
              }
            }}
            title="Clear all drawings"
          >
            🗑️
          </button>
        </div>
      </div>
      <main className="app-main">
        <YamlEditor value={yaml} onChange={setYaml} error={parseError} highlightLines={highlightLines} flashLines={flashLines} onAddNode={handleAddNode} onAddConnection={handleAddConnection} notes={notes} onNotesChange={setNotes} activeEditorTab={editorTab} onEditorTabChange={setEditorTab} />
        <DiagramCanvas data={diagram} theme={theme} onNodeMove={handleNodeMove} onNodeClick={handleNodeClick} onConnectionClick={handleConnectionClick} svgRef={svgRef} drawMode={drawMode} drawCanvasRef={drawCanvasRef} activeDiagramId={activeId} />
      </main>
      {copyFeedback && <div className="copy-toast">📋 YAML copied to clipboard!</div>}
    </div>
  );
}

export default App;
