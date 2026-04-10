import React, { useEffect, useRef } from 'react';
import type { Hardpoints, HardpointId } from '../../model/types';

const HP_IDS: HardpointId[] = [
  'UBIF', 'UBIR', 'UBJ',
  'LBIF', 'LBIR', 'LBJ',
  'TRI', 'TRO',
  'SU', 'SL', 'DU', 'DL',
];

const HP_LABELS: Record<HardpointId, string> = {
  UBIF: 'Upper inner front',
  UBIR: 'Upper inner rear',
  UBJ: 'Upper ball joint',
  LBIF: 'Lower inner front',
  LBIR: 'Lower inner rear',
  LBJ: 'Lower ball joint',
  TRI: 'Tie rod inner',
  TRO: 'Tie rod outer',
  SU: 'Spring upper',
  SL: 'Spring lower',
  DU: 'Damper upper',
  DL: 'Damper lower',
};

interface Props {
  hardpoints: Hardpoints;
  onChange: (hp: Hardpoints) => void;
  label: string;
  onFocusPoint?: (id: HardpointId | null) => void;
  focusPointId?: HardpointId | null;
}

export const HardpointEditor: React.FC<Props> = ({ hardpoints, onChange, label, onFocusPoint, focusPointId }) => {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // When focusPointId changes (from 3D click), focus the X input of that row
  useEffect(() => {
    if (focusPointId) {
      const el = inputRefs.current[`${focusPointId}-0`];
      if (el) {
        el.focus();
        el.select();
      }
    }
  }, [focusPointId]);
  const handleChange = (id: HardpointId, axis: 0 | 1 | 2, val: string) => {
    const n = parseFloat(val);
    if (isNaN(n)) return;
    const updated = { ...hardpoints };
    updated[id] = [...hardpoints[id]] as [number, number, number];
    updated[id][axis] = n;
    onChange(updated);
  };

  return (
    <div>
      <div style={{ fontWeight: 600, marginBottom: 4, color: '#6cf' }}>{label}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ color: '#888' }}>
            <th style={{ textAlign: 'left', padding: '2px 4px' }}>Point</th>
            <th style={{ width: 65, padding: '2px 4px' }}>X</th>
            <th style={{ width: 65, padding: '2px 4px' }}>Y</th>
            <th style={{ width: 65, padding: '2px 4px' }}>Z</th>
          </tr>
        </thead>
        <tbody>
          {HP_IDS.map(id => (
            <tr key={id} title={HP_LABELS[id]}>
              <td style={{ padding: '1px 4px', color: '#ccc' }}>{id}</td>
              {([0, 1, 2] as const).map(axis => (
                <td key={axis} style={{ padding: '1px 2px' }}>
                  <input
                    ref={el => { inputRefs.current[`${id}-${axis}`] = el; }}
                    type="number"
                    value={hardpoints[id][axis]}
                    onChange={e => handleChange(id, axis, e.target.value)}
                    onFocus={() => onFocusPoint?.(id)}
                    onBlur={() => onFocusPoint?.(null)}
                    style={{
                      width: '100%',
                      fontFamily: 'monospace',
                      fontSize: 11,
                      padding: '1px 3px',
                      background: '#1e1e1e',
                      color: '#ddd',
                      border: '1px solid #444',
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
