import { useState, useRef, useCallback, useEffect } from 'react';
import YamlEditor from './components/YamlEditor';
import DiagramCanvas from './components/DiagramCanvas';
import Toolbar from './components/Toolbar';
import { parseYaml } from './utils/yamlParser';
import { gridLayout, forceLayout } from './utils/layoutEngine';
import { exportSvgToFile, copyYamlToClipboard } from './utils/exportSvg';
import type { DiagramData, Theme } from './types/diagram';
import { DEFAULT_YAML } from './types/diagram';
import './App.css';

interface SavedDiagram {
  id: string;
  name: string;
  yaml: string;
  lastModified: number;
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
    return [{ id: newId(), name: 'Netflix Design', yaml: DEFAULT_YAML, lastModified: Date.now() }];
  });

  const [activeId, setActiveId] = useState<string>(() => {
    const saved = localStorage.getItem(ACTIVE_KEY);
    const ids = loadDiagrams().map((d) => d.id);
    if (saved && ids.includes(saved)) return saved;
    return diagrams[0].id;
  });

  const activeDiagram = diagrams.find((d) => d.id === activeId) || diagrams[0];
  const yaml = activeDiagram.yaml;

  const [diagram, setDiagram] = useState<DiagramData>({ nodes: [], connections: [] });
  const [parseError, setParseError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const initialLayoutDone = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist active tab
  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeId);
  }, [activeId]);

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
        const posMap = new Map(prev.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
        const hasNewNodes = data.nodes.some((n) => !posMap.has(n.id));

        let nodes = data.nodes.map((n) => {
          const existing = posMap.get(n.id);
          return existing ? { ...n, x: existing.x, y: existing.y } : n;
        });

        if (!initialLayoutDone.current || (hasNewNodes && nodes.some((n) => n.x === 0 && n.y === 0))) {
          nodes = forceLayout(nodes, data.connections, 800, 600);
          initialLayoutDone.current = true;
        }

        return { nodes, connections: data.connections };
      });
    }
  }, [yaml]);

  const setYaml = useCallback((newYaml: string) => {
    setDiagrams((prev) =>
      prev.map((d) =>
        d.id === activeId ? { ...d, yaml: newYaml, lastModified: Date.now() } : d
      )
    );
  }, [activeId]);

  const handleNewDiagram = useCallback(() => {
    const id = newId();
    const name = `Diagram ${diagrams.length + 1}`;
    setDiagrams((prev) => [...prev, { id, name, yaml: DEFAULT_YAML, lastModified: Date.now() }]);
    setActiveId(id);
    initialLayoutDone.current = false;
  }, [diagrams.length]);

  const handleDeleteDiagram = useCallback((id: string) => {
    setDiagrams((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((d) => d.id !== id);
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
    initialLayoutDone.current = false;
  }, [activeId]);

  const handleSelectTab = useCallback((id: string) => {
    setActiveId(id);
    initialLayoutDone.current = false;
  }, []);

  const handleNodeMove = useCallback((id: string, x: number, y: number) => {
    setDiagram((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
    }));
  }, []);

  const handleAutoLayout = useCallback((mode: 'grid' | 'force') => {
    setDiagram((prev) => {
      const nodes = mode === 'grid'
        ? gridLayout(prev.nodes, 800)
        : forceLayout(prev.nodes, prev.connections, 800, 600);
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
          >
            <span className="tab-name">{d.name}</span>
            {diagrams.length > 1 && (
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
      </div>
      <main className="app-main">
        <YamlEditor value={yaml} onChange={setYaml} error={parseError} />
        <DiagramCanvas data={diagram} theme={theme} onNodeMove={handleNodeMove} svgRef={svgRef} />
      </main>
      {copyFeedback && <div className="copy-toast">📋 YAML copied to clipboard!</div>}
    </div>
  );
}

export default App;
