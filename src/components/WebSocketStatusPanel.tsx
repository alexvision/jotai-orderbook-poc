import { useAtom } from 'jotai';
import { connectionAtom, envAtom, feedsSelectionAtom, logsAtom, apiKeyAtom, apiSecretAtom, connectAtom, disconnectAtom, connectionStateAtom } from '../state/websocket.ts';
import { groupSizeAtom } from '../state/orderbook.ts';

export function WebSocketStatusPanel() {
  const [environment, setEnvironment] = useAtom(envAtom);
  const [selectedFeeds, setSelectedFeeds] = useAtom(feedsSelectionAtom);
  const [logs, setLogs] = useAtom(logsAtom);
  const [apiKey, setApiKey] = useAtom(apiKeyAtom);
  const [apiSecret, setApiSecret] = useAtom(apiSecretAtom);
  const [, connect] = useAtom(connectAtom);
  const [, disconnect] = useAtom(disconnectAtom);
  const [connState] = useAtom(connectionStateAtom);
  const [groupSize, setGroupSize] = useAtom(groupSizeAtom);

  return (
    <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label>
          Environment:
          <select value={environment} onChange={e => setEnvironment(e.target.value as any)} style={{ marginLeft: 4 }}>
            <option value="devhk">DevHK</option>
            <option value="testnet">Testnet</option>
            <option value="prod">Prod</option>
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Group:
          <select value={groupSize} onChange={e => setGroupSize(Number(e.target.value))}>
            <option value={0}>Raw</option>
            <option value={0.5}>0.5</option>
            <option value={1}>1</option>
            <option value={2.5}>2.5</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
          </select>
        </label>
        <button onClick={() => connect()} disabled={connState.isConnected || connState.connecting}>Connect</button>
        <button onClick={() => disconnect()} disabled={!connState.isConnected}>Disconnect</button>
        <span style={{ fontFamily: 'monospace' }}>Status: {connState.connecting ? 'Connecting' : connState.isConnected ? 'Connected' : 'Disconnected'}</span>
        <span style={{ fontFamily: 'monospace' }}>Messages: {connState.messageCount}</span>
        <span style={{ fontFamily: 'monospace' }}>Last: {connState.lastUpdate ? new Date(connState.lastUpdate).toLocaleTimeString() : '-'}</span>
      </div>
      <div style={{ gridColumn: '1 / -1', display:'flex', flexWrap:'wrap', gap: '0.5rem' }}>
        {Object.entries(selectedFeeds).map(([key, value]) => (
          <label key={key} style={{ fontSize: 12 }}>
            <input
              type="checkbox"
              checked={value}
              onChange={e => setSelectedFeeds(p => ({ ...p, [key]: e.target.checked }))}
            /> {key}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
        <details open>
          <summary style={{ cursor: 'pointer' }}>Authentication (only needed for private feeds)</summary>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <input type="text" placeholder="API Key" value={apiKey} onChange={e => setApiKey(e.target.value)} style={{ flex: '1 1 200px' }} />
            <input type="password" placeholder="API Secret" value={apiSecret} onChange={e => setApiSecret(e.target.value)} style={{ flex: '1 1 200px' }} />
          </div>
        </details>
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <textarea value={logs} onChange={e => setLogs(e.target.value)} style={{ width: '100%', height: 160, background: '#161b22', color: '#e6edf3', fontFamily: 'monospace', fontSize: 12 }} />
      </div>
    </div>
  );
}
