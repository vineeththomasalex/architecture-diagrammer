import React, { useRef, useCallback, useEffect, useState } from 'react';
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

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightYamlToHtml(text: string, flashStart?: number, flashEnd?: number): string {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    let html = '';
    const isFlash = flashStart !== undefined && flashEnd !== undefined &&
      lineIdx >= flashStart && lineIdx <= flashEnd;

    if (isFlash) html += '<span class="yaml-flash">';

    const kwMatch = YAML_KEYWORDS.find((kw) => line.trimStart() === kw);
    if (kwMatch) {
      const indent = line.indexOf(kwMatch);
      if (indent > 0) html += escHtml(line.slice(0, indent));
      html += `<span style="color:#FF79C6">${escHtml(kwMatch)}</span>`;
    } else {
      const fieldMatch = line.match(/^(\s*-?\s*)(id|label|type|from|to)(:)(.*)/);
      if (fieldMatch) {
        const [, indent, fieldName, colon, value] = fieldMatch;
        html += escHtml(indent);
        html += `<span style="color:#8BE9FD">${escHtml(fieldName + colon)}</span>`;
        const trimmedVal = value.trimStart();
        const valIndent = value.slice(0, value.length - trimmedVal.length);
        if (fieldName === 'type' && trimmedVal) {
          const asNode = trimmedVal as NodeType;
          const asConn = trimmedVal as ConnectionType;
          if (nodeTypeNames.includes(asNode)) {
            html += escHtml(valIndent);
            html += `<span style="color:${NODE_COLORS[asNode]}">${escHtml(trimmedVal)}</span>`;
          } else if (connTypeNames.includes(asConn)) {
            html += escHtml(valIndent);
            html += `<span style="color:${CONNECTION_STYLES[asConn].stroke}">${escHtml(trimmedVal)}</span>`;
          } else {
            html += `<span style="color:#F1FA8C">${escHtml(value)}</span>`;
          }
        } else if (trimmedVal) {
          html += `<span style="color:#F8F8F2">${escHtml(value)}</span>`;
        }
      } else {
        const commentIdx = line.indexOf('#');
        if (commentIdx >= 0) {
          html += `<span style="color:#6272A4">${escHtml(line)}</span>`;
        } else {
          html += `<span style="color:#F8F8F2">${escHtml(line)}</span>`;
        }
      }
    }

    if (isFlash) html += '</span>';
    return html;
  }).join('\n');
}

// Save and restore cursor position in a contentEditable element
function saveCaret(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(el);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

function restoreCaret(el: HTMLElement, pos: number) {
  const sel = window.getSelection();
  if (!sel) return;
  let remaining = pos;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    if (remaining <= node.length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    remaining -= node.length;
  }
  // If we couldn't find position, place at end
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

const YamlEditor: React.FC<Props> = ({
  value, onChange, error, highlightLines, flashLines: flashLinesProp,
  onAddNode, onAddConnection, notes, onNotesChange, activeEditorTab, onEditorTabChange,
}) => {
  const yamlRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);
  const notesInitialized = useRef(false);
  const isUpdatingFromProp = useRef(false);
  const [flashLines, setFlashLines] = useState<{ start: number; end: number } | null>(null);

  // Sync value prop → contentEditable innerHTML (only when value changes externally)
  useEffect(() => {
    const el = yamlRef.current;
    if (!el) return;
    const currentText = el.innerText;
    // Normalize: innerText may add/remove trailing newline
    if (currentText.replace(/\n$/, '') === value.replace(/\n$/, '')) return;
    isUpdatingFromProp.current = true;
    const pos = saveCaret(el);
    el.innerHTML = highlightYamlToHtml(value, flashLines?.start, flashLines?.end);
    restoreCaret(el, pos);
    isUpdatingFromProp.current = false;
  }, [value, flashLines]);

  const handleYamlInput = useCallback(() => {
    if (isUpdatingFromProp.current) return;
    const el = yamlRef.current;
    if (!el) return;
    const text = el.innerText;
    // Re-highlight after a short delay to avoid cursor jump during typing
    const pos = saveCaret(el);
    onChange(text);
    // Defer re-highlight to next frame
    requestAnimationFrame(() => {
      if (!yamlRef.current) return;
      isUpdatingFromProp.current = true;
      yamlRef.current.innerHTML = highlightYamlToHtml(text);
      restoreCaret(yamlRef.current, pos);
      isUpdatingFromProp.current = false;
    });
  }, [onChange]);

  // Handle paste — insert plain text only
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }, []);

  // Handle Tab key — insert 2 spaces
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '  ');
    }
  }, []);

  // Double-click highlight from diagram
  useEffect(() => {
    if (!highlightLines || !yamlRef.current) return;
    onEditorTabChange('yaml');
    setTimeout(() => {
      const el = yamlRef.current;
      if (!el) return;
      const text = el.innerText;
      const lines = text.split('\n');
      let startPos = 0;
      for (let i = 0; i < highlightLines.start; i++) {
        startPos += lines[i].length + 1;
      }
      let endPos = startPos;
      for (let i = highlightLines.start; i <= Math.min(highlightLines.end, lines.length - 1); i++) {
        endPos += lines[i].length + 1;
      }
      el.focus();
      // Select the range
      const sel = window.getSelection();
      if (!sel) return;
      restoreCaret(el, startPos);
      const range = sel.getRangeAt(0);
      // Extend to end
      let remaining = endPos - 1 - startPos;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node: Text | null;
      let found = false;
      // First get to startPos
      let skip = startPos;
      while ((node = walker.nextNode() as Text | null)) {
        if (skip <= node.length) {
          range.setStart(node, skip);
          remaining += skip;
          break;
        }
        skip -= node.length;
      }
      // Now extend
      remaining = endPos - 1 - startPos;
      while (node && remaining > 0) {
        const available = node.length - (node === range.startContainer ? range.startOffset : 0);
        if (remaining <= available) {
          range.setEnd(node, (node === range.startContainer ? range.startOffset : 0) + remaining);
          found = true;
          break;
        }
        remaining -= available;
        node = walker.nextNode() as Text | null;
        if (node) {
          if (remaining <= node.length) {
            range.setEnd(node, remaining);
            found = true;
            break;
          }
        }
      }
      if (!found) {
        range.selectNodeContents(el);
      }
      sel.removeAllRanges();
      sel.addRange(range);
      // Scroll into view
      const lineHeight = 20.8;
      el.scrollTop = Math.max(0, highlightLines.start * lineHeight - 60);
    }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightLines]);

  // Flash
  useEffect(() => {
    if (flashLinesProp) setFlashLines(flashLinesProp);
  }, [flashLinesProp]);

  useEffect(() => {
    if (!flashLines) return;
    const timer = setTimeout(() => setFlashLines(null), 1200);
    return () => clearTimeout(timer);
  }, [flashLines]);

  useEffect(() => {
    if (!flashLines || !yamlRef.current) return;
    const lineHeight = 20.8;
    yamlRef.current.scrollTop = Math.max(0, flashLines.start * lineHeight - 60);
  }, [flashLines]);

  // Notes
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
    if (notesRef.current) onNotesChange(notesRef.current.innerHTML);
  }, [onNotesChange]);

  const handleNotesKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); document.execCommand('bold'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); document.execCommand('italic'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); document.execCommand('underline'); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '7') { e.preventDefault(); document.execCommand('insertOrderedList'); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '8') { e.preventDefault(); document.execCommand('insertUnorderedList'); }
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
            <div
              ref={yamlRef}
              className="yaml-editor"
              contentEditable
              suppressContentEditableWarning
              onInput={handleYamlInput}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              data-placeholder="Define your architecture here..."
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
