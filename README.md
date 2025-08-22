# Jotai BitMEX Order Book POC

Minimal proof of concept using Jotai to manage BitMEX WebSocket order book state.

## Features
- Environment switching (DevHK / Testnet / Prod)
- Optional authentication (URL signature) for private feeds
- Subscription selection
- Jotai-managed WebSocket lifecycle atoms
- OrderBookL2 incremental updates into derived sorted arrays
- Simple UI with status, logs, and top-of-book display

## Development
Install deps and start dev server:

```bash
pnpm install # or npm install / yarn
pnpm dev
```

Open http://localhost:5173

## Notes
This is a simplified parser for orderBookL2 feed (id-based price/size mapping simplified). Not production ready.
