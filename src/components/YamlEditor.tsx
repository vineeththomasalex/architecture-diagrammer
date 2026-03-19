import React, { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { NODE_COLORS, CONNECTION_STYLES, type NodeType, type ConnectionType } from '../types/diagram';
import ReferencePanel from './ReferencePanel';

interface Props {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  highlightLines?: { start: number; end: number } | null;
  flashLines?: { start: number; end: number } | null;
  onAddNode?: (type: NodeType) => void;
  onAddConnection?: (type: ConnectionType) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  activeEditorTab: 'yaml' | 'notes';
  onEditorTabChange: (tab: 'yaml' | 'notes') => void;
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

const YamlEditor: React.FC<Props> = ({ value, onChange, error, highlightLines, flashLines: flashLinesProp, onAddNode, onAddConnection, notes, onNotesChange, activeEditorTab, onEditorTabChange }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const notesInitialized = useRef(false);
  const [flashLines, setFlashLines] = useState<{ start: number; end: number } | null>(null);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  // Scroll textarea to highlighted lines and select them
  useEffect(() => {
    if (!highlightLines || !textareaRef.current) return;
    console.log("[YamlEditor] Highlighting lines:", highlightLines.start, "-", highlightLines.end);
    onEditorTabChange('yaml');
    // Small delay to let tab switch render before scrolling
    setTimeout(() => scrollToLines(highlightLines.start, highlightLines.end, true), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightLines]);

  // Flash animation for newly added entries
  useEffect(() => {
    if (flashLinesProp) setFlashLines(flashLinesProp);
  }, [flashLinesProp]);

  useEffect(() => {
    if (!flashLines) return;
    const timer = setTimeout(() => setFlashLines(null), 1200);
    return () => clearTimeout(timer);
  }, [flashLines]);

  // Scroll to flash target
  useEffect(() => {
    if (!flashLines || !textareaRef.current) return;
    scrollToLines(flashLines.start, flashLines.end, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashLines]);

  const scrollToLines = useCallback((start: number, end: number, select: boolean) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const lines = value.split('\n');
    let startPos = 0;
    for (let i = 0; i < start; i++) {
      startPos += lines[i].length + 1;
    }
    let endPos = startPos;
    for (let i = start; i <= Math.min(end, lines.length - 1); i++) {
      endPos += lines[i].length + 1;
    }
    ta.focus();
    if (select) {
      ta.setSelectionRange(startPos, endPos - 1);
    } else {
      ta.setSelectionRange(startPos, startPos);
    }
    const lineHeight = 20.8;
    ta.scrollTop = Math.max(0, start * lineHeight - 60);
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
    }
  }, [value]);

  const highlighted = useMemo(() => {
    const base = highlightYaml(value);
    if (!flashLines) return base;

    // Wrap flashing lines with a flash marker
    const lines = value.split('\n');
    return lines.map((line, lineIdx) => {
      const isFlash = lineIdx >= flashLines.start && lineIdx <= flashLines.end;
      const parts = highlightYaml(line + (lineIdx < lines.length - 1 ? '\n' : ''));
      if (isFlash) {
        return (
          <span key={lineIdx} className="yaml-flash">
            {parts}
          </span>
        );
      }
      return <React.Fragment key={lineIdx}>{parts}</React.Fragment>;
    });
  }, [value, flashLines]);

  // Initialize notes content when switching to notes tab
  useEffect(() => {
    if (activeEditorTab === 'notes' && notesRef.current && !notesInitialized.current) {
      notesRef.current.innerHTML = notes;
      notesInitialized.current = true;
    }
    if (activeEditorTab !== 'notes') {
      notesInitialized.current = false;
    }
  }, [activeEditorTab, notes]);

  const handleNotesInput = useCallback(() => {
    if (notesRef.current) {
      onNotesChange(notesRef.current.innerHTML);
    }
  }, [onNotesChange]);

  const handleNotesKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      document.execCommand('bold');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      document.execCommand('italic');
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      document.execCommand('underline');
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '7') {
      e.preventDefault();
      document.execCommand('insertOrderedList');
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '8') {
      e.preventDefault();
      document.execCommand('insertUnorderedList');
    }
  }, []);

  return (
    <div className="editor-panel">
      <div className="editor-tabs">
        <button
          className={`editor-tab ${activeEditorTab === 'yaml' ? 'editor-tab-active' : ''}`}
          onClick={() => onEditorTabChange('yaml')}
        >
          📝 YAML
        </button>
        <button
          className={`editor-tab ${activeEditorTab === 'notes' ? 'editor-tab-active' : ''}`}
          onClick={() => onEditorTabChange('notes')}
        >
          📓 Notes
        </button>
      </div>
      {activeEditorTab === 'yaml' ? (
        <>
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
          <ReferencePanel onAddNode={onAddNode} onAddConnection={onAddConnection} />
        </>
      ) : (
        <div className="notes-body">
          <div
            ref={notesRef}
            className="notes-editor"
            contentEditable
            suppressContentEditableWarning
            onInput={handleNotesInput}
            onKeyDown={handleNotesKeyDown}
            data-placeholder="Design notes, trade-offs, assumptions, interview talking points..."
          />
        </div>
      )}
    </div>
  );
};

export default YamlEditor;
