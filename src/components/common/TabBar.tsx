import React from 'react';

interface Props {
  tabs: string[];
  active: number;
  onChange: (index: number) => void;
}

export const TabBar: React.FC<Props> = ({ tabs, active, onChange }) => (
  <div style={{ display: 'flex', borderBottom: '1px solid #444', marginBottom: 8 }}>
    {tabs.map((tab, i) => (
      <button
        key={tab}
        onClick={() => onChange(i)}
        style={{
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: i === active ? 600 : 400,
          background: i === active ? '#2a2a2a' : 'transparent',
          color: i === active ? '#6cf' : '#aaa',
          border: 'none',
          borderBottom: i === active ? '2px solid #6cf' : '2px solid transparent',
          cursor: 'pointer',
        }}
      >
        {tab}
      </button>
    ))}
  </div>
);
