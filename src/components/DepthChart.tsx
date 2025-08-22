import { useAtomValue } from 'jotai';
import { orderBookAtomFamily } from '../state/orderbook.ts';

interface Props { symbol: string }

// Simple SVG depth chart (cumulative volume) for bids & asks.
export function DepthChart({ symbol }: Props) {
  const ob = useAtomValue(orderBookAtomFamily(symbol)) as { bids: Row[]; asks: Row[] };
  const maxLevels = 40; // limit for performance
  const bids = ob.bids.slice(0, maxLevels);
  const asks = ob.asks.slice(0, maxLevels);

  if (!bids.length && !asks.length) return <div style={containerStyle}>No depth</div>;

  // Build cumulative arrays
  const bidCum: Point[] = [];
  let acc = 0;
  for (const r of bids) { acc += r.size; bidCum.push({ price: r.price, cum: acc }); }
  const askCum: Point[] = [];
  acc = 0;
  for (const r of asks) { acc += r.size; askCum.push({ price: r.price, cum: acc }); }

  const maxCum = Math.max(bidCum.at(-1)?.cum || 0, askCum.at(-1)?.cum || 0) || 1;
  const mid = inferMid(bidCum, askCum);

  // Layout constants
  const width = 320; const height = 170; // a bit taller for labels
  const leftRightPad = 6; // horizontal padding
  const topPad = 18; // reserve space for labels
  const bottomPad = 6;

  // Scale helpers
  const xBid = (p: number) => {
    if (!bidCum.length) return width/2;
    const min = bidCum[bidCum.length-1].price; // lowest price shown (last in descending bids)
    const max = bidCum[0].price; // best bid
    return leftRightPad + ((p - min)/(max - min || 1)) * (width/2 - leftRightPad*2);
  };
  const xAsk = (p: number) => {
    if (!askCum.length) return width/2;
    const min = askCum[0].price; // best ask
    const max = askCum[askCum.length-1].price; // highest shown
    return width/2 + ((p - min)/(max - min || 1)) * (width/2 - leftRightPad*2);
  };
  const y = (c: number) => height - bottomPad - (c / maxCum) * (height - topPad - bottomPad);

  const bidPath = buildAreaPath(bidCum, xBid, y, true, width/2, height-bottomPad);
  const askPath = buildAreaPath(askCum, xAsk, y, false, width/2, height-bottomPad);

  return (
    <div style={containerStyle}>
  <div style={{ fontSize: 11, letterSpacing: 0.5, color: '#8b949e', marginBottom: 4 }}>Depth (Cumulative)</div>
  <svg width={width} height={height} style={{ display: 'block', background: '#0d1117', border: '1px solid #30363d', borderRadius: 4 }}>
        {/* mid divider */}
        <line x1={width/2} x2={width/2} y1={0} y2={height} stroke="#30363d" strokeDasharray="4 4" />
        {/* grid horizontal */}
        {Array.from({ length: 4 }).map((_,i)=> {
          const yy = topPad + (i/(4-1))*(height - topPad - bottomPad);
          return <line key={i} x1={0} x2={width} y1={yy} y2={yy} stroke="#161b22" strokeWidth={1} />;
        })}
        {/* Areas */}
        {bidCum.length > 0 && <path d={bidPath} fill="rgba(46,160,67,0.35)" stroke="#2ea043" strokeWidth={1} />}
        {askCum.length > 0 && <path d={askPath} fill="rgba(248,81,73,0.35)" stroke="#f85149" strokeWidth={1} />}
        {/* Mid label */}
  {mid && <text x={width/2 + 4} y={topPad - 6} fill="#8b949e" fontSize={10}>mid ~ {mid.toLocaleString()}</text>}
        {/* Cumulative labels (last points) */}
        {bidCum.length > 0 && (
          <text x={leftRightPad} y={Math.max(topPad + 10, y(bidCum.at(-1)!.cum)-4)} fill="#2ea043" fontSize={10}>{formatNumber(bidCum.at(-1)!.cum)}</text>
        )}
        {askCum.length > 0 && (
          <text x={width - leftRightPad - 4} y={Math.max(topPad + 10, y(askCum.at(-1)!.cum)-4)} fill="#f85149" fontSize={10} textAnchor="end">{formatNumber(askCum.at(-1)!.cum)}</text>
        )}
      </svg>
    </div>
  );
}

// Types
interface Row { price: number; size: number; updatedAt: number }
interface Point { price: number; cum: number }

function buildAreaPath(points: Point[], xFn: (p:number)=>number, yFn: (c:number)=>number, isBids: boolean, midX: number, baseY: number) {
  if (!points.length) return '';
  const ordered = isBids ? [...points].sort((a,b)=> b.price - a.price) : [...points].sort((a,b)=> a.price - b.price);
  let d = '';
  ordered.forEach((pt,i)=> {
    const x = xFn(pt.price); const y = yFn(pt.cum);
    d += (i===0?`M ${x} ${baseY} L ${x} ${y}`:` L ${x} ${y}`);
  });
  const last = ordered[ordered.length-1];
  const lastX = xFn(last.price);
  d += ` L ${lastX} ${baseY} Z`;
  return d;
}

function inferMid(bids: Point[], asks: Point[]) {
  if (!bids.length || !asks.length) return null;
  const bestBid = bids[0].price; // because sorted descending input earlier
  const bestAsk = asks[0].price;
  return (bestBid + bestAsk)/2;
}

function formatNumber(n: number) {
  if (n >= 1e6) return (n/1e6).toFixed(2)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return n.toString();
}

const containerStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
