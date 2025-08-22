import { Suspense } from 'react';
import { WebSocketStatusPanel } from './components/WebSocketStatusPanel.tsx';
import { OrderBook } from './components/OrderBook.tsx';
import { DepthChart } from './components/DepthChart.tsx';
import { TickerBar } from './components/TickerBar.tsx';

export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem', gap: '1rem' }}>
      <h1 style={{ margin: 0 }}>BitMEX Order Book (Jotai POC)</h1>
  <WebSocketStatusPanel />
  <TickerBar />
      <div style={{ flex: 1, display: 'flex', gap: '1rem', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
          <Suspense fallback={<div>Loading order book...</div>}>
            <OrderBook symbol="XBTUSD" />
          </Suspense>
        </div>
        <div style={{ width: 340 }}>
          <Suspense fallback={<div>Loading depth...</div>}>
            <DepthChart symbol="XBTUSD" />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
