import React from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}

const YamlEditor: React.FC<Props> = ({ value, onChange, error }) => {
  return (
    <div className="editor-panel">
      <div className="editor-header">
        <span>📝 YAML Definition</span>
      </div>
      <textarea
        className="yaml-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder="Define your architecture here..."
      />
      {error && <div className="editor-error">⚠ {error}</div>}
    </div>
  );
};

export default YamlEditor;
