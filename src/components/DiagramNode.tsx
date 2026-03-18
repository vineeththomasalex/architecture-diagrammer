import React from 'react';
import { NODE_WIDTH, NODE_HEIGHT, NODE_COLORS, type DiagramNode as DiagramNodeType, type NodeType } from '../types/diagram';

interface Props {
  node: DiagramNodeType;
  onDragStart: (id: string, e: React.MouseEvent) => void;
  textColor: string;
}

function getNodeShape(type: NodeType, color: string): React.ReactElement {
  switch (type) {
    case 'frontend':
      return <rect x="0" y="0" width={NODE_WIDTH} height={NODE_HEIGHT} rx="16" ry="16" fill={color} />;
    case 'database':
      return (
        <g>
          <rect x="0" y="8" width={NODE_WIDTH} height={NODE_HEIGHT - 16} fill={color} />
          <ellipse cx={NODE_WIDTH / 2} cy="8" rx={NODE_WIDTH / 2} ry="10" fill={color} />
          <ellipse cx={NODE_WIDTH / 2} cy={NODE_HEIGHT - 8} rx={NODE_WIDTH / 2} ry="10" fill={color} />
          <rect x="0" y="8" width={NODE_WIDTH} height={NODE_HEIGHT - 16} fill={color} opacity="0.8" />
          <ellipse cx={NODE_WIDTH / 2} cy="8" rx={NODE_WIDTH / 2} ry="10" fill={color} stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        </g>
      );
    case 'cache':
      return (
        <polygon
          points={`${NODE_WIDTH / 2},0 ${NODE_WIDTH},${NODE_HEIGHT / 2} ${NODE_WIDTH / 2},${NODE_HEIGHT} 0,${NODE_HEIGHT / 2}`}
          fill={color}
        />
      );
    case 'external':
      return (
        <rect
          x="0" y="0" width={NODE_WIDTH} height={NODE_HEIGHT} rx="4" ry="4"
          fill="transparent" stroke={color} strokeWidth="2" strokeDasharray="8 4"
        />
      );
    default:
      return <rect x="0" y="0" width={NODE_WIDTH} height={NODE_HEIGHT} rx="4" ry="4" fill={color} />;
  }
}

function getTypeIcon(type: NodeType): string {
  switch (type) {
    case 'frontend': return '🖥️';
    case 'backend': return '⚙️';
    case 'database': return '🗄️';
    case 'queue': return '📨';
    case 'cache': return '⚡';
    case 'external': return '🌐';
  }
}

const DiagramNode: React.FC<Props> = ({ node, onDragStart, textColor }) => {
  const color = NODE_COLORS[node.type];
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
        x={NODE_WIDTH / 2}
        y={NODE_HEIGHT / 2 - 8}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={labelColor}
        fontSize="13"
        fontWeight="600"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {getTypeIcon(node.type)} {node.label}
      </text>
      <text
        x={NODE_WIDTH / 2}
        y={NODE_HEIGHT / 2 + 12}
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

export default DiagramNode;
