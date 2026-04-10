import React, { useState } from 'react';
import type { SuspensionModel, HardpointId } from '../../model/types';
import { HardpointEditor } from './HardpointEditor';
import { NumberInput } from '../common/NumberInput';
import { TabBar } from '../common/TabBar';

interface PresetOption {
  id: string;
  label: string;
  description: string;
}

export interface FocusedHardpoint {
  corner: 'front' | 'rear';
  id: HardpointId;
}

interface Props {
  model: SuspensionModel;
  onChange: (model: SuspensionModel) => void;
  travel: number;
  onTravelChange: (t: number) => void;
  rackTravel: number;
  onRackTravelChange: (t: number) => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onImportJSON: (e: React.ChangeEvent<HTMLInputElement>) => void;
  presets: PresetOption[];
  onLoadPreset: (id: string) => void;
  onFocusHardpoint?: (hp: FocusedHardpoint | null) => void;
}

const TABS = ['Front HP', 'Rear HP', 'Vehicle', 'Springs', 'Dampers'];

export const InputPanel: React.FC<Props> = ({
  model, onChange, travel, onTravelChange, rackTravel, onRackTravelChange,
  onExportCSV, onExportJSON, onImportJSON, presets, onLoadPreset, onFocusHardpoint,
}) => {
  const [tab, setTab] = useState(0);

  const update = (partial: Partial<SuspensionModel>) => onChange({ ...model, ...partial });

  return (
    <div style={{
      width: 320,
      minWidth: 320,
      height: '100%',
      overflow: 'auto',
      padding: 12,
      background: '#1a1a1a',
      borderRight: '1px solid #333',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 4 }}>
        Suspension Kinematics
      </div>

      {/* Example presets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
        <div style={{ fontSize: 11, color: '#aaa' }}>Load Example</div>
        <select
          value=""
          onChange={e => { if (e.target.value) onLoadPreset(e.target.value); }}
          style={{
            width: '100%',
            padding: '4px 6px',
            fontSize: 11,
            background: '#2a2a2a',
            color: '#ccc',
            border: '1px solid #555',
            borderRadius: 3,
          }}
        >
          <option value="">-- select a preset --</option>
          {presets.map(p => (
            <option key={p.id} value={p.id} title={p.description}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Travel sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#aaa' }}>
          Wheel Travel: <span style={{ color: '#6cf' }}>{travel.toFixed(1)} mm</span>
        </div>
        <input
          type="range" min={-80} max={80} step={1} value={travel}
          onChange={e => onTravelChange(Number(e.target.value))}
          style={{ width: '100%' }}
        />
        <div style={{ fontSize: 11, color: '#aaa' }}>
          Rack Travel: <span style={{ color: '#6cf' }}>{rackTravel.toFixed(1)} mm</span>
        </div>
        <input
          type="range" min={-30} max={30} step={0.5} value={rackTravel}
          onChange={e => onRackTravelChange(Number(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 0 && (
          <HardpointEditor
            label="Front (RHS) Hardpoints (mm)"
            hardpoints={model.front.hardpoints}
            onChange={hp => update({ front: { ...model.front, hardpoints: hp } })}
            onFocusPoint={id => onFocusHardpoint?.(id ? { corner: 'front', id } : null)}
          />
        )}

        {tab === 1 && (
          <HardpointEditor
            label="Rear (RHS) Hardpoints (mm)"
            hardpoints={model.rear.hardpoints}
            onChange={hp => update({ rear: { ...model.rear, hardpoints: hp } })}
            onFocusPoint={id => onFocusHardpoint?.(id ? { corner: 'rear', id } : null)}
          />
        )}

        {tab === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 600, color: '#6cf' }}>Vehicle Parameters</div>
            <NumberInput label="Mass" value={model.vehicle.mass} onChange={v => update({ vehicle: { ...model.vehicle, mass: v } })} unit="kg" />
            <NumberInput label="CG H" value={model.vehicle.cgHeight} onChange={v => update({ vehicle: { ...model.vehicle, cgHeight: v } })} unit="mm" />
            <NumberInput label="WBase" value={model.vehicle.wheelbase} onChange={v => update({ vehicle: { ...model.vehicle, wheelbase: v } })} unit="mm" />
            <NumberInput label="CG→F" value={model.vehicle.cgToFrontAxle} onChange={v => update({ vehicle: { ...model.vehicle, cgToFrontAxle: v } })} unit="mm" />
            <NumberInput label="Trk F" value={model.vehicle.trackFront} onChange={v => update({ vehicle: { ...model.vehicle, trackFront: v } })} unit="mm" />
            <NumberInput label="Trk R" value={model.vehicle.trackRear} onChange={v => update({ vehicle: { ...model.vehicle, trackRear: v } })} unit="mm" />
            <NumberInput label="Tyre R" value={model.vehicle.tyreRadius} onChange={v => update({ vehicle: { ...model.vehicle, tyreRadius: v } })} unit="mm" />

            <div style={{ fontWeight: 600, color: '#6cf', marginTop: 8 }}>Upright (Front)</div>
            <NumberInput label="Stub%" value={model.front.upright.stubAxleRatio} step={0.01} onChange={v => update({ front: { ...model.front, upright: { ...model.front.upright, stubAxleRatio: v } } })} />
            <NumberInput label="StubL" value={model.front.upright.stubAxleLength} onChange={v => update({ front: { ...model.front, upright: { ...model.front.upright, stubAxleLength: v } } })} unit="mm" />
            <NumberInput label="ET" value={model.front.upright.wheelOffset} onChange={v => update({ front: { ...model.front, upright: { ...model.front.upright, wheelOffset: v } } })} unit="mm" />
            <NumberInput label="Camber" value={model.front.upright.stubAxleCamber} step={0.1} onChange={v => update({ front: { ...model.front, upright: { ...model.front.upright, stubAxleCamber: v } } })} unit="deg" />
            <NumberInput label="Caster" value={model.front.upright.stubAxleCaster} step={0.1} onChange={v => update({ front: { ...model.front, upright: { ...model.front.upright, stubAxleCaster: v } } })} unit="deg" />

            <div style={{ fontWeight: 600, color: '#6cf', marginTop: 8 }}>Upright (Rear)</div>
            <NumberInput label="Stub%" value={model.rear.upright.stubAxleRatio} step={0.01} onChange={v => update({ rear: { ...model.rear, upright: { ...model.rear.upright, stubAxleRatio: v } } })} />
            <NumberInput label="StubL" value={model.rear.upright.stubAxleLength} onChange={v => update({ rear: { ...model.rear, upright: { ...model.rear.upright, stubAxleLength: v } } })} unit="mm" />
            <NumberInput label="ET" value={model.rear.upright.wheelOffset} onChange={v => update({ rear: { ...model.rear, upright: { ...model.rear.upright, wheelOffset: v } } })} unit="mm" />
            <NumberInput label="Camber" value={model.rear.upright.stubAxleCamber} step={0.1} onChange={v => update({ rear: { ...model.rear, upright: { ...model.rear.upright, stubAxleCamber: v } } })} unit="deg" />
            <NumberInput label="Caster" value={model.rear.upright.stubAxleCaster} step={0.1} onChange={v => update({ rear: { ...model.rear, upright: { ...model.rear.upright, stubAxleCaster: v } } })} unit="deg" />

            <div style={{ fontWeight: 600, color: '#6cf', marginTop: 8 }}>Anti-Roll Bars</div>
            <NumberInput label="ARB F" value={model.arbFront.rate} onChange={v => update({ arbFront: { rate: v } })} unit="N/mm" />
            <NumberInput label="ARB R" value={model.arbRear.rate} onChange={v => update({ arbRear: { rate: v } })} unit="N/mm" />
          </div>
        )}

        {tab === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 600, color: '#6cf' }}>Front Spring</div>
            <NumberInput label="Rate" value={model.front.spring.rate} onChange={v => update({ front: { ...model.front, spring: { ...model.front.spring, rate: v } } })} unit="N/mm" />
            <NumberInput label="FreeL" value={model.front.spring.freeLength} onChange={v => update({ front: { ...model.front, spring: { ...model.front.spring, freeLength: v } } })} unit="mm" />
            <NumberInput label="Prelod" value={model.front.spring.preload} onChange={v => update({ front: { ...model.front, spring: { ...model.front.spring, preload: v } } })} unit="N" />

            <div style={{ fontWeight: 600, color: '#6cf', marginTop: 8 }}>Rear Spring</div>
            <NumberInput label="Rate" value={model.rear.spring.rate} onChange={v => update({ rear: { ...model.rear, spring: { ...model.rear.spring, rate: v } } })} unit="N/mm" />
            <NumberInput label="FreeL" value={model.rear.spring.freeLength} onChange={v => update({ rear: { ...model.rear, spring: { ...model.rear.spring, freeLength: v } } })} unit="mm" />
            <NumberInput label="Prelod" value={model.rear.spring.preload} onChange={v => update({ rear: { ...model.rear, spring: { ...model.rear.spring, preload: v } } })} unit="N" />
          </div>
        )}

        {tab === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 600, color: '#6cf' }}>Damper F-V Curves</div>
            <div style={{ fontSize: 11, color: '#888' }}>
              Edit bump/rebound F-V points in the damper chart panel.
              The default curve data is shown in the charts on the right.
            </div>
          </div>
        )}
      </div>

      {/* Export/Import */}
      <div style={{ borderTop: '1px solid #333', paddingTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={onExportCSV} style={btnStyle}>Export CSV</button>
        <button onClick={onExportJSON} style={btnStyle}>Save JSON</button>
        <label style={{ ...btnStyle, cursor: 'pointer' }}>
          Load JSON
          <input type="file" accept=".json" onChange={onImportJSON} style={{ display: 'none' }} />
        </label>
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 11,
  background: '#333',
  color: '#ccc',
  border: '1px solid #555',
  borderRadius: 3,
  cursor: 'pointer',
};
