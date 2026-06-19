// NeutronTrader - Expandable help tooltip

import { useState } from 'react';

export default function HelpIcon({ text }) {
  const [open, setOpen] = useState(false);

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', marginLeft: '6px' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title="Click for help"
        style={{
          width: '18px', height: '18px', borderRadius: '50%',
          border: '1px solid #555', background: '#1a1a1a', color: '#aaa',
          fontSize: '11px', cursor: 'pointer', lineHeight: 1, padding: 0,
        }}
      >
        ?
      </button>
      {open && (
        <span style={{
          display: 'block', marginTop: '6px', padding: '8px 10px',
          background: '#1a2a3a', border: '1px solid #334', borderRadius: '4px',
          fontSize: '12px', color: '#ccc', maxWidth: '320px', lineHeight: 1.4,
        }}>
          {text}
        </span>
      )}
    </span>
  );
}
