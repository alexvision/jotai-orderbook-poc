import { useAtomValue } from 'jotai';
import { allInstrumentsAtom, approximateUsdNotional } from '../state/orderbook.ts';

export function TickerBar() {
  const instruments = useAtomValue(allInstrumentsAtom);
  const entries = Object.entries(instruments)
    .filter(([sym, t]) => !sym.startsWith('.') && t.lastPrice != null)
    .sort((a,b)=> {
      const av = approximateUsdNotional(a[1]) ?? 0;
      const bv = approximateUsdNotional(b[1]) ?? 0;
      if (bv !== av) return bv - av; // descending
      return a[0].localeCompare(b[0]);
    });

  if (!entries.length) return null;

  return (
    <div style={{
      display: 'flex',
      gap: 16,
      overflowX: 'auto',
      padding: '4px 8px',
      background: '#161b22',
      border: '1px solid #30363d',
      borderRadius: 4,
      fontFamily: 'monospace',
      fontSize: 12
    }}>
      {entries.map(([sym, t]) => (
        <Ticker
          key={sym}
          symbol={sym}
          last={t.lastPrice!}
          updatedAt={t.updatedAt}
          vol={approximateUsdNotional(t)}
          changeDir={t.changeDir}
          changeAt={t.changeAt}
        />
      ))}
    </div>
  );
}

function Ticker({ symbol, last, updatedAt, vol, changeDir, changeAt }: { symbol: string; last: number; updatedAt: number; vol?: number; changeDir?: 'up' | 'down'; changeAt?: number }) {
  const now = Date.now();
  const age = now - updatedAt;
  const generalMs = 800;
  const genIntensity = Math.max(0, 1 - age / generalMs);
  const flashGeneral = genIntensity > 0 ? `rgba(255,255,255,${0.05 * genIntensity})` : 'transparent';

  let changeOverlay = 'transparent';
  if (changeDir && changeAt) {
    const changeAge = now - changeAt;
    const changeWindow = 900;
    const changeIntensity = Math.max(0, 1 - changeAge / changeWindow);
    if (changeIntensity > 0) {
      const base = changeDir === 'up' ? '0,200,90' : '200,50,50';
      changeOverlay = `rgba(${base},${0.35 * changeIntensity})`;
    }
  }
  return (
    <div style={{ position: 'relative', padding: '2px 6px', borderRadius: 4, background: flashGeneral, transition: 'background .4s linear', display: 'flex', gap: 6, alignItems: 'center' }}>
      {changeOverlay !== 'transparent' && (
        <div style={{ position: 'absolute', inset: 0, background: changeOverlay, borderRadius: 4, pointerEvents: 'none', transition: 'background .4s linear' }} />
      )}
      <span style={{ color: '#8b949e', zIndex: 1 }}>{symbol}</span>
      <span style={{ color: changeDir === 'up' ? '#2ea043' : changeDir === 'down' ? '#f85149' : '#e6edf3', fontWeight: 600, zIndex: 1 }}>{last.toLocaleString()}</span>
      {vol != null && <span style={{ color: '#8b949e', zIndex: 1 }}>{abbrev(vol)}</span>}
    </div>
  );
}

function abbrev(n: number) {
  if (n >= 1e9) return (n/1e9).toFixed(2)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(2)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return n.toString();
}
