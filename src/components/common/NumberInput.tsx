import React, { useState, useCallback } from 'react';

interface Props {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  unit?: string;
  width?: number;
}

export const NumberInput: React.FC<Props> = ({ label, value, onChange, step = 1, unit, width = 80 }) => {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  const displayed = focused ? text : String(Math.round(value * 1000) / 1000);

  const handleBlur = useCallback(() => {
    setFocused(false);
    const parsed = parseFloat(text);
    if (!isNaN(parsed)) onChange(parsed);
    else setText(String(value));
  }, [text, value, onChange]);

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
      <span style={{ minWidth: 40 }}>{label}</span>
      <input
        type="number"
        value={displayed}
        step={step}
        style={{ width, fontFamily: 'monospace', fontSize: 12, padding: '2px 4px' }}
        onFocus={() => { setFocused(true); setText(String(value)); }}
        onChange={e => { setText(e.target.value); }}
        onBlur={handleBlur}
        onKeyDown={e => { if (e.key === 'Enter') handleBlur(); }}
      />
      {unit && <span style={{ color: '#888', fontSize: 11 }}>{unit}</span>}
    </label>
  );
};
