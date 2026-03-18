import React from 'react';
import type { DiagramNode, DiagramConnection as ConnectionType } from '../types/diagram';
import { NODE_WIDTH, NODE_HEIGHT } from '../types/diagram';

interface Props {
  connection: ConnectionType;
  nodes: DiagramNode[];
  textColor: string;
}

const DiagramConnection: React.FC<Props> = ({ connection, nodes, textColor }) => {
  const source = nodes.find((n) => n.id === connection.from);
  const target = nodes.find((n) => n.id === connection.to);
  if (!source || !target) return null;

  const sx = source.x + NODE_WIDTH / 2;
  const sy = source.y + NODE_HEIGHT / 2;
  const tx = target.x + NODE_WIDTH / 2;
  const ty = target.y + NODE_HEIGHT / 2;

  // Calculate angle for endpoint offset
  const angle = Math.atan2(ty - sy, tx - sx);
  const startX = sx + Math.cos(angle) * (NODE_WIDTH / 2);
  const startY = sy + Math.sin(angle) * (NODE_HEIGHT / 2);
  const endX = tx - Math.cos(angle) * (NODE_WIDTH / 2);
  const endY = ty - Math.sin(angle) * (NODE_HEIGHT / 2);

  // Curved path via control point
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const dx = endX - startX;
  const dy = endY - startY;
  const offset = Math.min(30, Math.sqrt(dx * dx + dy * dy) * 0.15);
  const cpX = midX - (dy / Math.sqrt(dx * dx + dy * dy + 1)) * offset;
  const cpY = midY + (dx / Math.sqrt(dx * dx + dy * dy + 1)) * offset;

  const path = `M ${startX} ${startY} Q ${cpX} ${cpY} ${endX} ${endY}`;

  return (
    <g className="diagram-connection">
      <path d={path} stroke={textColor} strokeWidth="1.5" fill="none" opacity="0.6" markerEnd="url(#arrowhead)" />
      {connection.label && (
        <text
          x={cpX}
          y={cpY - 8}
          textAnchor="middle"
          fill={textColor}
          fontSize="11"
          opacity="0.8"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {connection.label}
        </text>
      )}
    </g>
  );
};

export default DiagramConnection;
