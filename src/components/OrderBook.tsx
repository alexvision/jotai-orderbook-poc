import { useAtomValue } from 'jotai';
import { orderBookAtomFamily, tickerAtom } from '../state/orderbook.ts';

interface Props { symbol: string }

interface DerivedOB { bids: Row[]; asks: Row[] }
export function OrderBook({ symbol }: Props) {
  const ob = useAtomValue(orderBookAtomFamily(symbol)) as DerivedOB;
  // subscribe to ticker to trigger re-render for fading effect
  useAtomValue(tickerAtom); // passive subscription only

  return (
    <div style={{ flex: 1, display: 'flex', gap: '1rem', minHeight: 0 }}>
  <OrderBookSide title="Bids" rows={ob.bids} color="#2ea043" />
  <OrderBookSide title="Asks" rows={ob.asks} color="#f85149" />
    </div>
  );
}

type Row = { price: number; size: number; updatedAt: number };
function OrderBookSide({ title, rows, color }: { title: string; rows: Row[]; color: string }) {
  const now = Date.now();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ fontWeight: 600, fontSize: 12, letterSpacing: 1 }}>{title}</div>
      <div style={{ display: 'flex', padding: '0 4px 2px', fontFamily: 'monospace', fontSize: 11, color: '#8b949e', gap: 8, fontWeight: 500 }}>
        <span style={{ minWidth: 70, textAlign: title === 'Bids' ? 'left' : 'right' }}>Price</span>
        <span style={{ minWidth: 70, textAlign: 'right' }}>Size</span>
        <span style={{ minWidth: 90, textAlign: 'right' }}>Cum</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.2, paddingRight: 4 }}>
        {(() => {
          const slice = rows.slice(0, 25);
          let running = 0;
          const total = slice.reduce((s, x) => s + x.size, 0) || 1;
          return slice.map(r => {
            running += r.size;
            const age = now - r.updatedAt;
            const highlightMs = 900;
            const flashIntensity = r.updatedAt ? Math.max(0, 1 - age / highlightMs) : 0;
            const cumPct = Math.min(100, (running / total) * 100);
            const barColor = title === 'Bids' ? 'rgba(46,160,67,0.12)' : 'rgba(248,81,73,0.12)';
            const flashColor = title === 'Bids' ? 'rgba(46,160,67,0.45)' : 'rgba(248,81,73,0.45)';
            return (
              <div
                key={r.price}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 4px',
                  fontWeight: 600,
                  lineHeight: '1.25',
                  background: 'transparent',
                  gap: 8
                }}
              >
                {/* cumulative bar */}
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: title === 'Bids' ? 0 : undefined, right: title === 'Asks' ? 0 : undefined, width: cumPct + '%', background: barColor, pointerEvents: 'none', zIndex: 0 }} />
                {flashIntensity > 0 && (
                  <div style={{ position: 'absolute', inset: 0, background: flashColor, opacity: flashIntensity, mixBlendMode: 'screen', pointerEvents: 'none', transition: 'opacity 0.4s linear', zIndex: 1 }} />
                )}
                <span style={{ color, zIndex: 2, fontVariantNumeric: 'tabular-nums', minWidth: 70, textAlign: title === 'Bids' ? 'left' : 'right' }}>{r.price.toLocaleString()}</span>
                <span style={{ zIndex: 2, color: '#e6edf3', fontVariantNumeric: 'tabular-nums', minWidth: 70, textAlign: 'right' }}>{r.size.toLocaleString()}</span>
                <span style={{ zIndex: 2, color: '#8b949e', fontVariantNumeric: 'tabular-nums', minWidth: 90, textAlign: 'right' }}>{running.toLocaleString()}</span>
              </div>
            );
          });
        })()}
      </div>
    </div>
  );
}
