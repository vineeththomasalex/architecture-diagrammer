export type NodeType =
  | 'client' | 'cdn' | 'loadbalancer' | 'gateway'
  | 'service' | 'worker' | 'database' | 'nosql'
  | 'cache' | 'queue' | 'stream' | 'storage'
  | 'search' | 'notification' | 'dns' | 'external';

export type ConnectionType = 'sync' | 'async' | 'pubsub' | 'websocket' | 'grpc' | 'stream';

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
  type?: ConnectionType;
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
  type?: string;
}

export interface RawDiagram {
  nodes?: RawNode[];
  connections?: RawConnection[];
}

export type Theme = 'dark' | 'light' | 'blueprint';

export const NODE_WIDTH = 160;
export const NODE_HEIGHT = 70;

export const NODE_COLORS: Record<NodeType, string> = {
  client:       '#4A90D9',
  cdn:          '#45B7D1',
  loadbalancer: '#96CEB4',
  gateway:      '#88D8B0',
  service:      '#50C878',
  worker:       '#7CB342',
  database:     '#E8A838',
  nosql:        '#F4A460',
  cache:        '#E74C3C',
  queue:        '#9B59B6',
  stream:       '#AB47BC',
  storage:      '#FF8A65',
  search:       '#FFD54F',
  notification: '#FF7043',
  dns:          '#78909C',
  external:     '#95A5A6',
};

export const NODE_ICONS: Record<NodeType, string> = {
  client:       '🖥️',
  cdn:          '🌍',
  loadbalancer: '⚖️',
  gateway:      '🚪',
  service:      '⚙️',
  worker:       '👷',
  database:     '🗄️',
  nosql:        '📄',
  cache:        '⚡',
  queue:        '📨',
  stream:       '🌊',
  storage:      '📦',
  search:       '🔍',
  notification: '🔔',
  dns:          '🏷️',
  external:     '🌐',
};

export const CONNECTION_STYLES: Record<ConnectionType, { stroke: string; dasharray: string; label: string }> = {
  sync:      { stroke: '#e0e0e0', dasharray: '',          label: 'HTTP/REST' },
  async:     { stroke: '#9B59B6', dasharray: '8 4',       label: 'Async' },
  pubsub:    { stroke: '#AB47BC', dasharray: '4 4',       label: 'Pub/Sub' },
  websocket: { stroke: '#4A90D9', dasharray: '12 4 4 4',  label: 'WebSocket' },
  grpc:      { stroke: '#50C878', dasharray: '2 2',       label: 'gRPC' },
  stream:    { stroke: '#FF8A65', dasharray: '6 3',       label: 'Stream' },
};

export const THEME_STYLES: Record<Theme, { bg: string; surface: string; text: string; grid: string }> = {
  dark: { bg: '#1a1a2e', surface: '#16213e', text: '#e0e0e0', grid: '#2a2a4a' },
  light: { bg: '#f5f5f5', surface: '#ffffff', text: '#333333', grid: '#e0e0e0' },
  blueprint: { bg: '#1b3a5c', surface: '#1e4976', text: '#c8ddf0', grid: '#2a5a8c' },
};

export const DEFAULT_YAML = `nodes:
  - id: client
    label: Client Apps
    type: client
  - id: cdn
    label: CDN
    type: cdn
  - id: dns
    label: DNS
    type: dns
  - id: lb
    label: Load Balancer
    type: loadbalancer
  - id: gateway
    label: API Gateway
    type: gateway
  - id: auth
    label: Auth Service
    type: service
  - id: catalog
    label: Catalog Service
    type: service
  - id: streaming
    label: Streaming Service
    type: service
  - id: recommend
    label: Recommendation Engine
    type: service
  - id: transcode
    label: Transcoding Worker
    type: worker
  - id: userdb
    label: User DB
    type: database
  - id: contentdb
    label: Content Metadata
    type: nosql
  - id: videostorage
    label: Video Storage
    type: storage
  - id: rediscache
    label: Redis Cache
    type: cache
  - id: kafka
    label: Event Bus
    type: stream
  - id: search
    label: Search Engine
    type: search
  - id: notif
    label: Notifications
    type: notification

connections:
  - from: client
    to: dns
    label: DNS Lookup
    type: sync
  - from: client
    to: cdn
    label: Video Stream
    type: stream
  - from: client
    to: lb
    label: API Requests
    type: sync
  - from: lb
    to: gateway
    label: Route
    type: sync
  - from: gateway
    to: auth
    label: Auth Check
    type: sync
  - from: gateway
    to: catalog
    label: Browse
    type: sync
  - from: gateway
    to: streaming
    label: Play
    type: sync
  - from: gateway
    to: search
    label: Search
    type: sync
  - from: catalog
    to: contentdb
    label: Query
    type: sync
  - from: catalog
    to: rediscache
    label: Cache
    type: sync
  - from: auth
    to: userdb
    label: User Data
    type: sync
  - from: streaming
    to: videostorage
    label: Fetch Video
    type: stream
  - from: streaming
    to: cdn
    label: Populate CDN
    type: async
  - from: transcode
    to: videostorage
    label: Upload
    type: async
  - from: kafka
    to: transcode
    label: Transcode Jobs
    type: pubsub
  - from: kafka
    to: recommend
    label: Watch Events
    type: pubsub
  - from: kafka
    to: notif
    label: Notifications
    type: pubsub
  - from: recommend
    to: contentdb
    label: ML Features
    type: sync
`;
