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

function App() {
  const [yaml, setYaml] = useState(DEFAULT_YAML);
  const [diagram, setDiagram] = useState<DiagramData>({ nodes: [], connections: [] });
  const [parseError, setParseError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>('dark');
  const [copyFeedback, setCopyFeedback] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const initialLayoutDone = useRef(false);

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
        <h1>Architecture Diagrammer 📐</h1>
        <Toolbar
          theme={theme}
          onThemeChange={setTheme}
          onAutoLayout={handleAutoLayout}
          onExportSvg={handleExportSvg}
          onCopyYaml={handleCopyYaml}
        />
      </header>
      <main className="app-main">
        <YamlEditor value={yaml} onChange={setYaml} error={parseError} />
        <DiagramCanvas data={diagram} theme={theme} onNodeMove={handleNodeMove} svgRef={svgRef} />
      </main>
      {copyFeedback && <div className="copy-toast">📋 YAML copied to clipboard!</div>}
    </div>
  );
}

export default App;
