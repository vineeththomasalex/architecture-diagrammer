import yaml from 'js-yaml';
import type { DiagramData, RawDiagram, NodeType } from '../types/diagram';

const VALID_TYPES: NodeType[] = ['frontend', 'backend', 'database', 'queue', 'cache', 'external'];

export function parseYaml(input: string): { data: DiagramData | null; error: string | null } {
  try {
    const raw = yaml.load(input) as RawDiagram;
    if (!raw || typeof raw !== 'object') {
      return { data: { nodes: [], connections: [] }, error: null };
    }

    const nodes = (raw.nodes || []).map((n, i) => ({
      id: n.id || `node-${i}`,
      label: n.label || n.id || `Node ${i}`,
      type: (VALID_TYPES.includes(n.type as NodeType) ? n.type : 'backend') as NodeType,
      x: 0,
      y: 0,
    }));

    const nodeIds = new Set(nodes.map((n) => n.id));
    const connections = (raw.connections || [])
      .filter((c) => nodeIds.has(c.from) && nodeIds.has(c.to))
      .map((c) => ({
        from: c.from,
        to: c.to,
        label: c.label,
      }));

    return { data: { nodes, connections }, error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}
