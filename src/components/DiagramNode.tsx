import React from 'react';
import { NODE_WIDTH, NODE_HEIGHT, NODE_COLORS, NODE_ICONS, type DiagramNode as DiagramNodeType, type NodeType } from '../types/diagram';

interface Props {
  node: DiagramNodeType;
  onDragStart: (id: string, e: React.MouseEvent) => void;
  textColor: string;
}

const W = NODE_WIDTH;
const H = NODE_HEIGHT;

function getNodeShape(type: NodeType, color: string): React.ReactElement {
  switch (type) {
    // Rounded rect — client, cdn, nosql, dns
    case 'client':
    case 'cdn':
    case 'nosql':
    case 'dns':
      return <rect x="0" y="0" width={W} height={H} rx="14" ry="14" fill={color} />;

    // Wide/short rect — loadbalancer, gateway
    case 'loadbalancer':
    case 'gateway':
      return <rect x="-10" y="6" width={W + 20} height={H - 12} rx="6" ry="6" fill={color} />;

    // Standard rect — service, worker, search, notification, storage
    case 'service':
    case 'worker':
    case 'search':
    case 'notification':
    case 'storage':
      return <rect x="0" y="0" width={W} height={H} rx="4" ry="4" fill={color} />;

    // Cylinder — database
    case 'database':
      return (
        <g>
          <rect x="0" y="8" width={W} height={H - 16} fill={color} />
          <ellipse cx={W / 2} cy="8" rx={W / 2} ry="10" fill={color} />
          <ellipse cx={W / 2} cy={H - 8} rx={W / 2} ry="10" fill={color} />
          <rect x="0" y="8" width={W} height={H - 16} fill={color} opacity="0.8" />
          <ellipse cx={W / 2} cy="8" rx={W / 2} ry="10" fill={color} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        </g>
      );

    // Diamond — cache
    case 'cache':
      return (
        <polygon
          points={`${W / 2},0 ${W},${H / 2} ${W / 2},${H} 0,${H / 2}`}
          fill={color}
        />
      );

    // Parallelogram — queue, stream
    case 'queue':
    case 'stream': {
      const skew = 16;
      return (
        <polygon
          points={`${skew},0 ${W},0 ${W - skew},${H} 0,${H}`}
          fill={color}
        />
      );
    }

    // Dashed border — external
    case 'external':
      return (
        <rect
          x="0" y="0" width={W} height={H} rx="4" ry="4"
          fill="transparent" stroke={color} strokeWidth="2" strokeDasharray="8 4"
        />
      );

    default:
      return <rect x="0" y="0" width={W} height={H} rx="4" ry="4" fill={color} />;
  }
}

const DiagramNodeComponent: React.FC<Props> = ({ node, onDragStart, textColor }) => {
  const color = NODE_COLORS[node.type];
  const icon = NODE_ICONS[node.type];
  const isExternal = node.type === 'external';
  const labelColor = isExternal ? textColor : '#fff';

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onMouseDown={(e) => onDragStart(node.id, e)}
      style={{ cursor: 'grab' }}
      className="diagram-node"
    >
      {getNodeShape(node.type, color)}
      <text
        x={W / 2}
        y={H / 2 - 8}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={labelColor}
        fontSize="13"
        fontWeight="600"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {icon} {node.label}
      </text>
      <text
        x={W / 2}
        y={H / 2 + 12}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={labelColor}
        fontSize="10"
        opacity="0.7"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {node.type}
      </text>
    </g>
  );
};

export default DiagramNodeComponent;
