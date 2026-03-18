import React, { useState } from 'react';
import { NODE_COLORS, NODE_ICONS, CONNECTION_STYLES, type NodeType, type ConnectionType } from '../types/diagram';

const nodeTypes = Object.keys(NODE_COLORS) as NodeType[];
const connTypes = Object.keys(CONNECTION_STYLES) as ConnectionType[];

const ReferencePanel: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="reference-panel">
      <button
        className="reference-toggle"
        onClick={() => setCollapsed(!collapsed)}
      >
        📖 Reference {collapsed ? '▸' : '▾'}
      </button>
      {!collapsed && (
        <div className="reference-content">
          <div className="reference-section">
            <div className="reference-section-title">Node Types</div>
            <div className="reference-grid">
              {nodeTypes.map((t) => (
                <div key={t} className="reference-item">
                  <span
                    className="reference-dot"
                    style={{ background: NODE_COLORS[t] }}
                  />
                  <span className="reference-icon">{NODE_ICONS[t]}</span>
                  <span className="reference-type">{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="reference-section">
            <div className="reference-section-title">Connection Types</div>
            <div className="reference-conn-list">
              {connTypes.map((ct) => {
                const s = CONNECTION_STYLES[ct];
                return (
                  <div key={ct} className="reference-conn-item">
                    <svg width="40" height="12" viewBox="0 0 40 12">
                      <line
                        x1="0" y1="6" x2="40" y2="6"
                        stroke={s.stroke}
                        strokeWidth="2"
                        strokeDasharray={s.dasharray}
                      />
                    </svg>
                    <span className="reference-conn-label" style={{ color: s.stroke }}>
                      {ct}
                    </span>
                    <span className="reference-conn-desc">{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferencePanel;
