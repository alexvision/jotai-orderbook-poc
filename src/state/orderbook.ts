import { atom } from 'jotai';

// We maintain per-symbol order book (L2) in a map.
// We'll store bids & asks sorted arrays (descending bids, ascending asks)
export interface OrderBookSideMap { [price: number]: number }
export interface OrderBookMetaMap { [price: number]: number } // timestamp (ms) of last update
export interface OrderBookState { bids: OrderBookSideMap; asks: OrderBookSideMap }
interface OrderBookMeta { bids: OrderBookMetaMap; asks: OrderBookMetaMap }

const booksAtom = atom<Record<string, OrderBookState>>({});
const booksMetaAtom = atom<Record<string, OrderBookMeta>>({});

const ensureBook = (books: Record<string, OrderBookState>, symbol: string): OrderBookState => {
  if (!books[symbol]) books[symbol] = { bids: {}, asks: {} };
  return books[symbol];
};
const ensureMeta = (meta: Record<string, OrderBookMeta>, symbol: string): OrderBookMeta => {
  if (!meta[symbol]) meta[symbol] = { bids: {}, asks: {} };
  return meta[symbol];
};

// Patch atom: receives raw BitMEX orderBookL2 messages
// We'll only implement partial subset: insert/update/delete
export interface L2Message {
  table: 'orderBookL2';
  action: 'partial' | 'insert' | 'update' | 'delete';
  data: { symbol: string; id: number; side: 'Buy' | 'Sell'; size?: number; price?: number }[];
}
// Writable atom expecting an L2Message
export const orderBookPatchAtom = atom(null, (get, set, msg: L2Message) => {
  const now = Date.now();
  set(booksAtom, (prev) => {
    const next: Record<string, OrderBookState> = { ...prev };
    set(booksMetaAtom, (prevMeta) => {
      const metaNext: Record<string, OrderBookMeta> = { ...prevMeta };
      for (const row of msg.data) {
        const book = ensureBook(next, row.symbol);
        const meta = ensureMeta(metaNext, row.symbol);
        if (msg.action === 'partial' || msg.action === 'insert') {
          if (row.price != null && row.size != null) {
            if (row.side === 'Buy') { book.bids[row.price] = row.size; meta.bids[row.price] = now; } else { book.asks[row.price] = row.size; meta.asks[row.price] = now; }
          }
        } else if (msg.action === 'update') {
          if (row.price != null && row.size != null) {
            if (row.side === 'Buy') { book.bids[row.price] = row.size; meta.bids[row.price] = now; } else { book.asks[row.price] = row.size; meta.asks[row.price] = now; }
          }
        } else if (msg.action === 'delete') {
          if (row.price != null) {
            if (row.side === 'Buy') { delete book.bids[row.price]; delete meta.bids[row.price]; } else { delete book.asks[row.price]; delete meta.asks[row.price]; }
          }
        }
      }
      return metaNext;
    });
    return next;
  });
});

function toSortedArrayWithMeta(side: OrderBookSideMap, meta: OrderBookMetaMap, desc: boolean) {
  const arr = Object.entries(side).map(([p, s]) => ({ price: Number(p), size: s, updatedAt: meta[Number(p)] || 0 }));
  arr.sort((a, b) => desc ? b.price - a.price : a.price - b.price);
  return arr;
}

// family for derived sorted arrays
const orderBookDerivedCache = new Map<string, any>();
export const orderBookAtomFamily = (symbol: string) => {
  if (!orderBookDerivedCache.has(symbol)) {
    const derived = atom(get => {
      const books = get(booksAtom);
      const metaAll = get(booksMetaAtom);
      const groupSize = get(groupSizeAtom);
      const book = books[symbol] || { bids: {}, asks: {} };
      const meta = metaAll[symbol] || { bids: {}, asks: {} };
      if (!groupSize || groupSize <= 0) {
        return {
          bids: toSortedArrayWithMeta(book.bids, meta.bids, true),
          asks: toSortedArrayWithMeta(book.asks, meta.asks, false)
        };
      }
      const agg = (sideMap: OrderBookSideMap, sideMeta: OrderBookMetaMap, isBids: boolean) => {
        const bucketSizes: Record<number, number> = {};
        const bucketMeta: Record<number, number> = {};
        for (const [pStr, size] of Object.entries(sideMap)) {
          const price = Number(pStr);
            // For bids we floor (aggregate lower), for asks we ceil (aggregate higher)
          const bucket = isBids ? Math.floor(price / groupSize) * groupSize : Math.ceil(price / groupSize) * groupSize;
          bucketSizes[bucket] = (bucketSizes[bucket] || 0) + size;
          const updatedAt = sideMeta[price] || 0;
          if (!bucketMeta[bucket] || updatedAt > bucketMeta[bucket]) bucketMeta[bucket] = updatedAt;
        }
        return Object.entries(bucketSizes).map(([bp, sz]) => ({ price: Number(bp), size: sz, updatedAt: bucketMeta[Number(bp)] || 0 }));
      };
      const bids = agg(book.bids, meta.bids, true).sort((a,b)=> b.price - a.price);
      const asks = agg(book.asks, meta.asks, false).sort((a,b)=> a.price - b.price);
      return { bids, asks };
    });
    orderBookDerivedCache.set(symbol, derived);
  }
  return orderBookDerivedCache.get(symbol);
};

// ticker atom to drive time-based fades
export const tickerAtom = atom(Date.now());
(tickerAtom as any).onMount = (set: (v: number) => void) => {
  const id = setInterval(() => set(Date.now()), 1000);
  return () => clearInterval(id);
};

// grouping size in price units (e.g., 0.5, 1, 2.5). 0 or null = no grouping
export const groupSizeAtom = atom<number>(1);

// Instrument (ticker) state: map symbol -> last price / stats
export interface InstrumentTicker { lastPrice?: number; markPrice?: number; indexPrice?: number; fundingRate?: number; volume24h?: number; homeNotional24h?: number; foreignNotional24h?: number; turnover24h?: number; updatedAt: number; changeDir?: 'up' | 'down'; changeAt?: number; isInverse?: boolean; isQuanto?: boolean; isLinear?: boolean; quoteCurrency?: string; multiplier?: number }
const instrumentsAtom = atom<Record<string, InstrumentTicker>>({});
export const instrumentUpdateAtom = atom(null, (get, set, rows: any[]) => {
  set(instrumentsAtom, prev => {
    const next = { ...prev };
    const now = Date.now();
    for (const r of rows) {
      const sym = r.symbol;
      if (!sym) continue;
      const prevTicker = next[sym] || { updatedAt: 0 };
      const newLast = r.lastPrice ?? prevTicker.lastPrice;
      let changeDir = prevTicker.changeDir;
      let changeAt = prevTicker.changeAt;
      if (r.lastPrice != null && prevTicker.lastPrice != null && r.lastPrice !== prevTicker.lastPrice) {
        changeDir = r.lastPrice > prevTicker.lastPrice ? 'up' : 'down';
        changeAt = now;
      }
      next[sym] = {
        lastPrice: newLast,
        markPrice: r.markPrice ?? prevTicker.markPrice,
        indexPrice: r.indicativeSettlePrice ?? prevTicker.indexPrice,
        fundingRate: r.fundingRate ?? prevTicker.fundingRate,
  volume24h: r.volume24h ?? prevTicker.volume24h,
        homeNotional24h: r.homeNotional24h ?? prevTicker.homeNotional24h,
        foreignNotional24h: r.foreignNotional24h ?? prevTicker.foreignNotional24h,
  turnover24h: r.turnover24h ?? prevTicker.turnover24h,
        updatedAt: now,
        changeDir,
        changeAt,
        isInverse: r.isInverse ?? prevTicker.isInverse,
        isQuanto: r.isQuanto ?? prevTicker.isQuanto,
        isLinear: r.isLinear ?? prevTicker.isLinear,
        quoteCurrency: r.quoteCurrency ?? prevTicker.quoteCurrency,
        multiplier: r.multiplier ?? prevTicker.multiplier
      };
    }
    return next;
  });
});
export const allInstrumentsAtom = atom(get => get(instrumentsAtom));

// Normalize a size or turnover into approximate USD notional given instrument metadata.
// For linear contracts (e.g., USDT-margined), turnover24h is often already USD.
// For inverse (XBTUSD), homeNotional is in BTC; multiply by lastPrice to get USD.
// For quanto, use multiplier if provided: size * multiplier * lastPrice (simplified approximation).
export function approximateUsdNotional(t: InstrumentTicker): number | undefined {
  if (!t) return undefined;
  if (t.turnover24h) return t.turnover24h; // prefer direct turnover if already quoted in USD
  if (t.isInverse && t.homeNotional24h != null && t.lastPrice != null) {
    return t.homeNotional24h * t.lastPrice; // BTC * USD/BTC => USD
  }
  if (t.isLinear && t.volume24h != null && t.lastPrice != null) {
    // volume24h may be contracts; if multiplier present adjust
    const mult = t.multiplier && t.multiplier > 0 ? t.multiplier : 1;
    return t.volume24h * mult * t.lastPrice;
  }
  if (t.isQuanto && t.volume24h != null && t.lastPrice != null) {
    const mult = t.multiplier && t.multiplier > 0 ? t.multiplier : 1;
    return t.volume24h * mult * t.lastPrice;
  }
  // fallback to foreignNotional if present (often quote currency already)
  if (t.foreignNotional24h != null) return t.foreignNotional24h;
  return undefined;
}
