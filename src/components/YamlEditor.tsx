import React, { useRef, useCallback, useMemo } from 'react';
import { NODE_COLORS, CONNECTION_STYLES, type NodeType, type ConnectionType } from '../types/diagram';
import ReferencePanel from './ReferencePanel';

interface Props {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}

const YAML_KEYWORDS = ['nodes:', 'connections:'];

const nodeTypeNames = Object.keys(NODE_COLORS) as NodeType[];
const connTypeNames = Object.keys(CONNECTION_STYLES) as ConnectionType[];

function highlightYaml(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    // Check for top-level YAML keywords
    const kwMatch = YAML_KEYWORDS.find((kw) => remaining.trimStart() === kw);
    if (kwMatch) {
      const indent = remaining.indexOf(kwMatch);
      if (indent > 0) parts.push(remaining.slice(0, indent));
      parts.push(<span key={key++} style={{ color: '#FF79C6' }}>{kwMatch}</span>);
      remaining = '';
    }

    if (remaining) {
      // Check for field keys like "  id:", "  type:", etc.
      const fieldMatch = remaining.match(/^(\s*-?\s*)(id|label|type|from|to)(:)(.*)/);
      if (fieldMatch) {
        const [, indent, fieldName, colon, value] = fieldMatch;
        parts.push(indent);
        parts.push(<span key={key++} style={{ color: '#8BE9FD' }}>{fieldName}{colon}</span>);

        const trimmedVal = value.trimStart();
        const valIndent = value.slice(0, value.length - trimmedVal.length);

        if (fieldName === 'type' && trimmedVal) {
          // Color type values by their category
          const asNode = trimmedVal as NodeType;
          const asConn = trimmedVal as ConnectionType;
          if (nodeTypeNames.includes(asNode)) {
            parts.push(valIndent);
            parts.push(<span key={key++} style={{ color: NODE_COLORS[asNode] }}>{trimmedVal}</span>);
          } else if (connTypeNames.includes(asConn)) {
            parts.push(valIndent);
            parts.push(<span key={key++} style={{ color: CONNECTION_STYLES[asConn].stroke }}>{trimmedVal}</span>);
          } else {
            parts.push(<span key={key++} style={{ color: '#F1FA8C' }}>{value}</span>);
          }
        } else if (trimmedVal) {
          parts.push(<span key={key++} style={{ color: '#F8F8F2' }}>{value}</span>);
        }
      } else {
        // Comment or plain line
        const commentIdx = remaining.indexOf('#');
        if (commentIdx >= 0) {
          parts.push(<span key={key++} style={{ color: '#6272A4' }}>{remaining.slice(0, commentIdx)}</span>);
          parts.push(<span key={key++} style={{ color: '#6272A4' }}>{remaining.slice(commentIdx)}</span>);
        } else {
          parts.push(<span key={key++} style={{ color: '#F8F8F2' }}>{remaining}</span>);
        }
      }
    }

    return (
      <React.Fragment key={lineIdx}>
        {parts}
        {lineIdx < lines.length - 1 ? '\n' : ''}
      </React.Fragment>
    );
  });
}

const YamlEditor: React.FC<Props> = ({ value, onChange, error }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const highlighted = useMemo(() => highlightYaml(value), [value]);

  return (
    <div className="editor-panel">
      <div className="editor-header">
        <span>📝 YAML Definition</span>
      </div>
      <div className="editor-body">
        <pre ref={preRef} className="yaml-highlight" aria-hidden="true">
          <code>{highlighted}</code>
        </pre>
        <textarea
          ref={textareaRef}
          className="yaml-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          placeholder="Define your architecture here..."
        />
      </div>
      {error && <div className="editor-error">⚠ {error}</div>}
      <ReferencePanel />
    </div>
  );
};

export default YamlEditor;
