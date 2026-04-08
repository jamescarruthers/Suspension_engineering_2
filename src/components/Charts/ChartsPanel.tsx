import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend,
} from 'recharts';
import type { GeometryOutputs, DamperSpec, RollAnalysis } from '../../model/types';
import { TabBar } from '../common/TabBar';

interface Props {
  frontOutputs: GeometryOutputs[];
  rearOutputs: GeometryOutputs[];
  damperFront: DamperSpec;
  damperRear: DamperSpec;
  rollAnalysis: RollAnalysis | null;
  currentTravel: number;
}

const CHART_TABS = ['Geometry', 'Motion Ratio', 'Roll & LLT', 'Damper'];

const chartMargin = { top: 5, right: 20, left: 5, bottom: 5 };

function SmallChart({ title, data, dataKey, color, xKey = 'travel', xLabel = 'Travel (mm)', yLabel = '' }: {
  title: string;
  data: { [key: string]: number }[];
  dataKey: string;
  color: string;
  xKey?: string;
  xLabel?: string;
  yLabel?: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>{title}</div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey={xKey} tick={{ fontSize: 10 }} stroke="#666" />
          <YAxis tick={{ fontSize: 10 }} stroke="#666" />
          <Tooltip
            contentStyle={{ background: '#222', border: '1px solid #444', fontSize: 11 }}
            labelStyle={{ color: '#aaa' }}
          />
          <Line type="monotone" dataKey={dataKey} stroke={color} dot={false} strokeWidth={1.5} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DualChart({ title, data, key1, key2, color1, color2, label1, label2 }: {
  title: string;
  data: { [key: string]: number }[];
  key1: string; key2: string;
  color1: string; color2: string;
  label1: string; label2: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>{title}</div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="travel" tick={{ fontSize: 10 }} stroke="#666" />
          <YAxis tick={{ fontSize: 10 }} stroke="#666" />
          <Tooltip
            contentStyle={{ background: '#222', border: '1px solid #444', fontSize: 11 }}
          />
          <Legend wrapperStyle={{ fontSize: 10 }} />
          <Line type="monotone" dataKey={key1} name={label1} stroke={color1} dot={false} strokeWidth={1.5} />
          <Line type="monotone" dataKey={key2} name={label2} stroke={color2} dot={false} strokeWidth={1.5} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export const ChartsPanel: React.FC<Props> = ({
  frontOutputs, rearOutputs, damperFront, damperRear, rollAnalysis, currentTravel,
}) => {
  const [tab, setTab] = useState(0);

  // Merge front/rear data for comparison charts
  const mergedData = frontOutputs.map((fo, i) => {
    const ro = rearOutputs[i] || rearOutputs[rearOutputs.length - 1];
    return {
      travel: fo.travel,
      camberF: parseFloat(fo.camber.toFixed(3)),
      camberR: ro ? parseFloat(ro.camber.toFixed(3)) : 0,
      toeF: parseFloat(fo.toe.toFixed(3)),
      toeR: ro ? parseFloat(ro.toe.toFixed(3)) : 0,
      caster: parseFloat(fo.caster.toFixed(3)),
      kpi: parseFloat(fo.kpi.toFixed(3)),
      scrubRadius: parseFloat(fo.scrubRadius.toFixed(2)),
      mechTrail: parseFloat(fo.mechanicalTrail.toFixed(2)),
      rcHeightF: parseFloat(fo.rollCentreHeight.toFixed(2)),
      rcHeightR: ro ? parseFloat(ro.rollCentreHeight.toFixed(2)) : 0,
      mrSpringF: parseFloat(fo.motionRatioSpring.toFixed(4)),
      mrSpringR: ro ? parseFloat(ro.motionRatioSpring.toFixed(4)) : 0,
      wheelRateF: parseFloat(fo.wheelRate.toFixed(3)),
      wheelRateR: ro ? parseFloat(ro.wheelRate.toFixed(3)) : 0,
      springLenF: parseFloat(fo.springLength.toFixed(2)),
      springLenR: ro ? parseFloat(ro.springLength.toFixed(2)) : 0,
    };
  });

  return (
    <div style={{
      width: 380,
      minWidth: 380,
      height: '100%',
      overflow: 'auto',
      padding: 12,
      background: '#1a1a1a',
      borderLeft: '1px solid #333',
    }}>
      <TabBar tabs={CHART_TABS} active={tab} onChange={setTab} />

      {tab === 0 && (
        <div>
          <DualChart title="Camber vs Travel" data={mergedData} key1="camberF" key2="camberR" color1="#ff6666" color2="#66aaff" label1="Front" label2="Rear" />
          <DualChart title="Toe vs Travel" data={mergedData} key1="toeF" key2="toeR" color1="#ff6666" color2="#66aaff" label1="Front" label2="Rear" />
          <SmallChart title="Caster vs Travel (Front)" data={mergedData} dataKey="caster" color="#ffaa44" />
          <SmallChart title="KPI vs Travel (Front)" data={mergedData} dataKey="kpi" color="#aa66ff" />
          <SmallChart title="Scrub Radius vs Travel (Front)" data={mergedData} dataKey="scrubRadius" color="#66cc99" />
          <SmallChart title="Mechanical Trail vs Travel (Front)" data={mergedData} dataKey="mechTrail" color="#cc6699" />
        </div>
      )}

      {tab === 1 && (
        <div>
          <DualChart title="Spring Motion Ratio vs Travel" data={mergedData} key1="mrSpringF" key2="mrSpringR" color1="#44cc44" color2="#44aaaa" label1="Front" label2="Rear" />
          <DualChart title="Wheel Rate vs Travel (N/mm)" data={mergedData} key1="wheelRateF" key2="wheelRateR" color1="#ff8844" color2="#8844ff" label1="Front" label2="Rear" />
          <DualChart title="Spring Length vs Travel (mm)" data={mergedData} key1="springLenF" key2="springLenR" color1="#44cc44" color2="#44aaaa" label1="Front" label2="Rear" />
          <DualChart title="Roll Centre Height vs Travel (mm)" data={mergedData} key1="rcHeightF" key2="rcHeightR" color1="#ff6666" color2="#66aaff" label1="Front" label2="Rear" />
        </div>
      )}

      {tab === 2 && rollAnalysis && (
        <div>
          <div style={{ fontSize: 12, color: '#ccc', marginBottom: 12 }}>
            <table style={{ width: '100%', fontSize: 11 }}>
              <tbody>
                <tr><td style={{ color: '#888' }}>Roll Rate Front</td><td>{(rollAnalysis.rollRateFront / 1e6).toFixed(1)} kN·m/rad</td></tr>
                <tr><td style={{ color: '#888' }}>Roll Rate Rear</td><td>{(rollAnalysis.rollRateRear / 1e6).toFixed(1)} kN·m/rad</td></tr>
                <tr><td style={{ color: '#888' }}>Roll Rate Total</td><td>{(rollAnalysis.rollRateTotal / 1e6).toFixed(1)} kN·m/rad</td></tr>
                <tr><td style={{ color: '#888' }}>Roll Gradient</td><td>{rollAnalysis.rollGradient.toFixed(2)} deg/g</td></tr>
                <tr><td style={{ color: '#888' }}>LLTD (Front %)</td><td>{(rollAnalysis.lltd * 100).toFixed(1)}%</td></tr>
                <tr><td style={{ color: '#888' }}>RC Height Front</td><td>{rollAnalysis.rollCentreHeightFront.toFixed(1)} mm</td></tr>
                <tr><td style={{ color: '#888' }}>RC Height Rear</td><td>{rollAnalysis.rollCentreHeightRear.toFixed(1)} mm</td></tr>
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>LLTD Distribution</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={[
              { name: 'Front', value: rollAnalysis.lltd * 100, fill: '#ff6666' },
              { name: 'Rear', value: (1 - rollAnalysis.lltd) * 100, fill: '#66aaff' },
            ]} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#666" />
              <YAxis tick={{ fontSize: 10 }} stroke="#666" domain={[0, 100]} />
              <Tooltip contentStyle={{ background: '#222', border: '1px solid #444', fontSize: 11 }} />
              <Bar dataKey="value" name="LLT %">
                {[0, 1].map(i => (
                  <Cell key={i} fill={i === 0 ? '#ff6666' : '#66aaff'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {tab === 3 && (
        <div>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Front Damper F-V (Bump & Rebound)</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="velocity" type="number" tick={{ fontSize: 10 }} stroke="#666" allowDuplicatedCategory={false} />
              <YAxis tick={{ fontSize: 10 }} stroke="#666" />
              <Tooltip contentStyle={{ background: '#222', border: '1px solid #444', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line data={damperFront.bump} type="monotone" dataKey="force" name="Bump" stroke="#ff8844" dot strokeWidth={1.5} />
              <Line data={damperFront.rebound} type="monotone" dataKey="force" name="Rebound" stroke="#4488ff" dot strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>

          <div style={{ fontSize: 11, color: '#aaa', marginTop: 12, marginBottom: 4 }}>Rear Damper F-V (Bump & Rebound)</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="velocity" type="number" tick={{ fontSize: 10 }} stroke="#666" allowDuplicatedCategory={false} />
              <YAxis tick={{ fontSize: 10 }} stroke="#666" />
              <Tooltip contentStyle={{ background: '#222', border: '1px solid #444', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line data={damperRear.bump} type="monotone" dataKey="force" name="Bump" stroke="#ff8844" dot strokeWidth={1.5} />
              <Line data={damperRear.rebound} type="monotone" dataKey="force" name="Rebound" stroke="#4488ff" dot strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Current position readout */}
      {frontOutputs.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid #333', paddingTop: 8 }}>
          <div style={{ fontSize: 11, color: '#6cf', marginBottom: 4 }}>Current Values (Front)</div>
          {(() => {
            const cur = frontOutputs.find(o => Math.abs(o.travel - currentTravel) < 1.5) ?? frontOutputs[0];
            if (!cur) return null;
            return (
              <table style={{ fontSize: 10, color: '#ccc', width: '100%' }}>
                <tbody>
                  <tr><td style={{ color: '#888' }}>Camber</td><td>{cur.camber.toFixed(3)}&deg;</td></tr>
                  <tr><td style={{ color: '#888' }}>Toe</td><td>{cur.toe.toFixed(3)}&deg;</td></tr>
                  <tr><td style={{ color: '#888' }}>Caster</td><td>{cur.caster.toFixed(3)}&deg;</td></tr>
                  <tr><td style={{ color: '#888' }}>KPI</td><td>{cur.kpi.toFixed(3)}&deg;</td></tr>
                  <tr><td style={{ color: '#888' }}>Scrub R</td><td>{cur.scrubRadius.toFixed(1)} mm</td></tr>
                  <tr><td style={{ color: '#888' }}>Mech Trail</td><td>{cur.mechanicalTrail.toFixed(1)} mm</td></tr>
                  <tr><td style={{ color: '#888' }}>MR (spring)</td><td>{cur.motionRatioSpring.toFixed(4)}</td></tr>
                  <tr><td style={{ color: '#888' }}>Wheel Rate</td><td>{cur.wheelRate.toFixed(2)} N/mm</td></tr>
                  <tr><td style={{ color: '#888' }}>RC Height</td><td>{cur.rollCentreHeight.toFixed(1)} mm</td></tr>
                </tbody>
              </table>
            );
          })()}
        </div>
      )}
    </div>
  );
};
