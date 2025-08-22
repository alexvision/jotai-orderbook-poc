import { atom } from 'jotai';
import CryptoJS from 'crypto-js';
import { orderBookPatchAtom, L2Message, instrumentUpdateAtom } from './orderbook.ts';

export type EnvironmentKey = 'devhk' | 'testnet' | 'prod';

export const environments: Record<EnvironmentKey, { name: string; url: string; description: string }> = {
  devhk: { name: 'DevHK', url: 'wss://ws.devhk.bitmex.com/realtime', description: 'Development (Hong Kong)' },
  testnet: { name: 'Testnet', url: 'wss://ws.testnet.bitmex.com/realtime', description: 'Test Environment' },
  prod: { name: 'Production', url: 'wss://ws.bitmex.com/realtime', description: 'Live Trading' }
};

// Basic atoms
export const envAtom = atom<EnvironmentKey>('testnet');
export const feedsSelectionAtom = atom<Record<string, boolean>>({
  'orderBookL2:XBTUSD': true,
  'trade:XBTUSD': false,
  'instrument': true,
  'execution': false,
  'order': false,
  'position': false,
  'margin': false,
  'wallet': false
});
export const apiKeyAtom = atom('');
export const apiSecretAtom = atom('');
export const logsAtom = atom('');

// connection state
export interface ConnectionState {
  isConnected: boolean;
  connecting: boolean;
  messageCount: number;
  lastUpdate: number | null;
  error?: string;
}
export const connectionStateAtom = atom<ConnectionState>({ isConnected: false, connecting: false, messageCount: 0, lastUpdate: null });

// internal mutable WebSocket reference
let ws: WebSocket | null = null;

const appendLogAtom = atom(null, (get, set, message: string) => {
  const timestamp = new Date().toTimeString().split(' ')[0];
  set(logsAtom, prev => prev + `[${timestamp}] ${message}\n`);
});

function generateAuthSignature(secret: string, method: string, path: string, expires: number, data = '') {
  const msg = method + path + expires + data;
  return CryptoJS.HmacSHA256(msg, secret).toString();
}

export const connectAtom = atom(null, async (get, set) => {
  const env = get(envAtom);
  const feeds = get(feedsSelectionAtom);
  const selectedFeeds = Object.entries(feeds).filter(([, v]) => v).map(([k]) => k);
  if (!selectedFeeds.length) {
    set(connectionStateAtom, s => ({ ...s, error: 'Select at least one feed' }));
    return;
  }
  const privateRoots = new Set(['execution','order','position','margin','wallet']);
  const needsAuth = selectedFeeds.some(f => privateRoots.has(f.split(':')[0]));
  const apiKey = get(apiKeyAtom);
  const apiSecret = get(apiSecretAtom);
  if (needsAuth && (!apiKey || !apiSecret)) {
    set(connectionStateAtom, s => ({ ...s, error: 'API key + secret required' }));
    return;
  }

  if (ws) {
    ws.close();
  }
  set(connectionStateAtom, { isConnected: false, connecting: true, messageCount: 0, lastUpdate: null });
  set(appendLogAtom, `Connecting to ${env}`);
  let url = environments[env].url;
  if (needsAuth) {
    const expires = Math.round(Date.now()/1000) + 60;
    const sig = generateAuthSignature(apiSecret, 'GET', '/realtime', expires);
    const params = new URLSearchParams({ 'api-expires': expires.toString(), 'api-signature': sig, 'api-key': apiKey });
    url += '?' + params.toString();
  }
  ws = new WebSocket(url);
  ws.onopen = () => {
    set(appendLogAtom, 'Connected');
    ws?.send(JSON.stringify({ op: 'subscribe', args: selectedFeeds }));
    set(appendLogAtom, 'Subscribed to ' + selectedFeeds.join(', '));
    set(connectionStateAtom, s => ({ ...s, isConnected: true, connecting: false }));
  };
  ws.onerror = () => {
    set(appendLogAtom, 'WebSocket error');
    set(connectionStateAtom, s => ({ ...s, error: 'WebSocket error', connecting: false }));
  };
  ws.onclose = (ev) => {
    set(appendLogAtom, `Closed (${ev.code})`);
    set(connectionStateAtom, s => ({ ...s, isConnected: false, connecting: false }));
  };
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.subscribe) {
        set(appendLogAtom, `✓ Subscribed: ${data.subscribe}`);
        return;
      }
      if (data.info) { set(appendLogAtom, `Info: ${data.info}`); return; }
      if (data.error) { set(appendLogAtom, `Error: ${data.error}`); return; }
      if (data.table === 'orderBookL2' && data.action && Array.isArray(data.data)) {
        const msg: L2Message = data;
        set(orderBookPatchAtom, msg);
      } else if (data.table === 'instrument' && Array.isArray(data.data)) {
        set(instrumentUpdateAtom, data.data);
      }
      set(connectionStateAtom, s => ({ ...s, messageCount: s.messageCount + 1, lastUpdate: Date.now() }));
    } catch (e: any) {
      set(appendLogAtom, 'Parse error ' + e.message);
    }
  };
});

export const disconnectAtom = atom(null, (get, set) => {
  if (ws) {
    ws.close(1000, 'User disconnect');
    ws = null;
  }
  set(connectionStateAtom, s => ({ ...s, isConnected: false, connecting: false }));
  set(appendLogAtom, 'Disconnected');
});

// expose underlying ws for debug (readonly)
export const connectionAtom = atom(() => ws);
