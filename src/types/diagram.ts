export type NodeType = 'frontend' | 'backend' | 'database' | 'queue' | 'cache' | 'external';

export interface DiagramNode {
  id: string;
  label: string;
  type: NodeType;
  x: number;
  y: number;
}

export interface DiagramConnection {
  from: string;
  to: string;
  label?: string;
}

export interface DiagramData {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
}

export interface RawNode {
  id: string;
  label: string;
  type?: string;
}

export interface RawConnection {
  from: string;
  to: string;
  label?: string;
}

export interface RawDiagram {
  nodes?: RawNode[];
  connections?: RawConnection[];
}

export type Theme = 'dark' | 'light' | 'blueprint';

export const NODE_WIDTH = 160;
export const NODE_HEIGHT = 70;

export const NODE_COLORS: Record<NodeType, string> = {
  frontend: '#4A90D9',
  backend: '#50C878',
  database: '#E8A838',
  queue: '#9B59B6',
  cache: '#E74C3C',
  external: '#95A5A6',
};

export const THEME_STYLES: Record<Theme, { bg: string; surface: string; text: string; grid: string }> = {
  dark: { bg: '#1a1a2e', surface: '#16213e', text: '#e0e0e0', grid: '#2a2a4a' },
  light: { bg: '#f5f5f5', surface: '#ffffff', text: '#333333', grid: '#e0e0e0' },
  blueprint: { bg: '#1b3a5c', surface: '#1e4976', text: '#c8ddf0', grid: '#2a5a8c' },
};

export const DEFAULT_YAML = `nodes:
  - id: web
    label: Web App
    type: frontend
  - id: api
    label: API Server
    type: backend
  - id: db
    label: PostgreSQL
    type: database
  - id: cache
    label: Redis Cache
    type: cache

connections:
  - from: web
    to: api
    label: REST API
  - from: api
    to: db
    label: SQL Queries
  - from: api
    to: cache
    label: Cache Lookup
`;
