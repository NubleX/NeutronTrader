// NeutronTrader - Dashboard price feed state hook
// Primary: pushed snapshot events from main process (real-time)
// Fallback: IPC poll on mount + focus + every 30s

import { useState, useEffect, useRef, useCallback } from 'react';

const ARB_THRESHOLD_KEY = 'neutron_arb_threshold';
export function loadArbThreshold() {
  const v = parseFloat(localStorage.getItem(ARB_THRESHOLD_KEY));
  return Number.isFinite(v) ? v : 0.1;
}
export function saveArbThreshold(v) {
  localStorage.setItem(ARB_THRESHOLD_KEY, String(v));
}

const FALLBACK_POLL_MS = 30000;
const SAVE_DEBOUNCE_MS = 10000;

async function fetchSnapshot() {
  if (!window.electronAPI?.priceFeed?.getSnapshot) return null;
  try {
    const res = await window.electronAPI.priceFeed.getSnapshot();
    if (!res || res.success === false) return null;
    const snap = res.data ?? res;
    if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return null;
    if (Object.keys(snap).length === 0) return null;
    return snap;
  } catch {
    return null;
  }
}

async function loadCache() {
  if (!window.electronAPI?.dashboard?.load) return null;
  try {
    const res = await window.electronAPI.dashboard.load();
    return res?.data || null;
  } catch {
    return null;
  }
}

function saveCache(snap, mode, paused) {
  if (!window.electronAPI?.dashboard?.save) return;
  window.electronAPI.dashboard.save({ snapshot: snap, feedMode: mode, paused, savedAt: Date.now() });
}

export function usePriceFeed() {
  const [snapshot, setSnapshot] = useState({});
  const [arbThreshold, setArbThresholdState] = useState(loadArbThreshold);
  const [status, setStatus] = useState('CONNECTING');
  const [feedMode, setFeedMode] = useState('polling');
  const [latencyMs, setLatencyMs] = useState(null);
  const [paused, setPaused] = useState(false);
  const [stale, setStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const pausedRef = useRef(false);
  const feedModeRef = useRef('polling');
  const saveTimerRef = useRef(null);
  const liveRef = useRef(false); // has at least one live update come in?

  const applySnapshot = useCallback((snap, fromPush = false) => {
    if (pausedRef.current) return;
    setSnapshot(snap);
    setStale(false);
    setLastUpdated(Date.now());
    setStatus(prev => (prev === 'WS LIVE' ? 'WS LIVE' : 'LIVE'));
    liveRef.current = true;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(
      () => saveCache(snap, feedModeRef.current, pausedRef.current),
      SAVE_DEBOUNCE_MS
    );
  }, []);

  const poll = useCallback(async () => {
    if (pausedRef.current) return;
    const snap = await fetchSnapshot();
    if (snap) applySnapshot(snap);
  }, [applySnapshot]);

  useEffect(() => {
    if (!window.electronAPI?.priceFeed) {
      setStatus('NO ELECTRON API');
      return undefined;
    }

    let cancelled = false;

    // Load cache for instant initial render, then immediately poll for live data.
    // The live poll resolves quickly and applySnapshot overwrites the stale cache.
    (async () => {
      const cache = await loadCache();
      if (cancelled || liveRef.current) return; // live already came in, skip stale

      if (cache?.snapshot && Object.keys(cache.snapshot).length > 0) {
        setSnapshot(cache.snapshot);
        setStale(true);
        setStatus('STALE');
        setLastUpdated(cache.savedAt || null);
      }
      if (cache?.feedMode) {
        feedModeRef.current = cache.feedMode;
        setFeedMode(cache.feedMode);
      }
      if (cache?.paused) {
        pausedRef.current = true;
        setPaused(true);
        window.electronAPI?.dashboard?.setPaused?.(true);
      }
    })();

    // Immediate poll on mount
    poll();

    // Subscribe to real-time pushed snapshots from main process
    let unsubSnapshot = null;
    if (window.electronAPI.priceFeed.onSnapshot) {
      unsubSnapshot = window.electronAPI.priceFeed.onSnapshot(snap => {
        if (snap && typeof snap === 'object' && !Array.isArray(snap)) {
          applySnapshot(snap, true);
        }
      });
    }

    // Latency probe
    const pollLatency = async () => {
      if (pausedRef.current || !window.electronAPI.priceFeed?.getLatency) return;
      const res = await window.electronAPI.priceFeed.getLatency();
      if (res?.data != null) setLatencyMs(res.data);
    };
    pollLatency();
    const latencyId = setInterval(pollLatency, 5000);

    // Fallback poll (covers pause-resume, focus, long idle)
    const fallbackId = setInterval(poll, FALLBACK_POLL_MS);

    // Immediate re-poll on window focus / tab switch
    const onFocus = () => { if (!document.hidden) poll(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      cancelled = true;
      clearInterval(latencyId);
      clearInterval(fallbackId);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (typeof unsubSnapshot === 'function') unsubSnapshot();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []); // run once on mount

  const togglePause = useCallback(() => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    window.electronAPI?.dashboard?.setPaused?.(next);
    if (!next) poll();
  }, [poll]);

  const setArbThreshold = useCallback((v) => {
    const n = parseFloat(v);
    if (!Number.isFinite(n) || n < 0) return;
    saveArbThreshold(n);
    setArbThresholdState(n);
  }, []);

  const toggleFeedMode = useCallback(async () => {
    const next = feedModeRef.current === 'polling' ? 'websocket' : 'polling';
    if (!window.electronAPI?.priceFeed?.setMode) return;
    await window.electronAPI.priceFeed.setMode(next);
    feedModeRef.current = next;
    setFeedMode(next);
    setStatus(next === 'websocket' ? 'WS LIVE' : 'LIVE');
    poll();
  }, [poll]);

  return {
    snapshot,
    arbThreshold,
    setArbThreshold,
    status,
    feedMode,
    latencyMs,
    paused,
    stale,
    lastUpdated,
    togglePause,
    toggleFeedMode,
  };
}
