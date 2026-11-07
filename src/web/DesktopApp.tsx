import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFonts } from 'expo-font';

import { ChartWheel } from '../features/chart/render/ChartWheel';
import { buildConfiguration } from '../features/chart/config/buildConfiguration';
import type { ChartCalculationResponse } from '../features/chart/config/engine-types';
import { calculateChart } from '../features/chart/data/calculateChart';
import { BUNDLED_PRESET_NAMES, bundledPreset } from '../features/chart/display/presets';
import { validateDraft, type SavedChart } from '../features/chart/active/model';
import { DEFAULT_SETTINGS } from '../features/chart/settings/chartSettings';
import { useTheme } from '../theme';
import { ThemeModeProvider, useThemeMode } from '../theme/theme-context';
import { fontMap } from '../theme/fonts.gen';
import { loadAccountCharts, localRequest, type Account } from './account';
import './desktop.css';

const message = (error: unknown) => error instanceof Error ? error.message : String(error);

export function DesktopApp() {
  const [loaded, error] = useFonts(fontMap);
  if (!loaded && !error) return <div className="starting">Opening Kairōs…</div>;
  return <ThemeModeProvider><DesktopCharts /></ThemeModeProvider>;
}

function DesktopCharts() {
  const theme = useTheme();
  const appearance = useThemeMode();
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [handle, setHandle] = useState('');
  const [code, setCode] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [charts, setCharts] = useState<SavedChart[]>([]);
  const [selectedId, setSelectedId] = useState('now');
  const [search, setSearch] = useState('');
  const [preset, setPreset] = useState('classic');
  const [now, setNow] = useState(() => new Date().toISOString());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [exceptions, setExceptions] = useState(0);
  const download = useRef<AbortController | null>(null);
  const wheelBox = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(640);
  const [chart, setChart] = useState<ChartCalculationResponse | null>(null);
  const [chartError, setChartError] = useState('');

  useEffect(() => {
    let live = true;
    void localRequest<{ account: Account | null }>('session').then(result => {
      if (live) setAccount(result.account);
    }).catch(error => { if (live) setError(message(error)); }).finally(() => { if (live) setReady(true); });
    return () => { live = false; download.current?.abort(); };
  }, []);

  async function refresh() {
    download.current?.abort();
    const controller = new AbortController();
    download.current = controller;
    setBusy(true); setError(''); setStatus('Opening your library…');
    try {
      const result = await loadAccountCharts(controller.signal, setStatus);
      if (controller.signal.aborted) return;
      setCharts(result.charts); setExceptions(result.exceptions); setStatus('');
    } catch (error) {
      if (!controller.signal.aborted) { setError(message(error)); setStatus(''); }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  useEffect(() => {
    if (account) void refresh();
    // A new account must discard the previous account's charts immediately.
    return () => { download.current?.abort(); };
    // refresh captures no account-specific credentials; the local session owns them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.did]);

  const selected = charts.find(item => item.id === selectedId);
  const datetime = selected?.datetime ?? now;
  const settings = selected?.settings ?? DEFAULT_SETTINGS;
  useEffect(() => {
    if (selectedId !== 'now') return;
    const timer = setInterval(() => setNow(new Date().toISOString()), 60000);
    return () => clearInterval(timer);
  }, [selectedId]);
  useEffect(() => {
    let live = true;
    setChart(null); setChartError('');
    void calculateChart(datetime, settings).then(value => { if (live) setChart(value); })
      .catch(error => { if (live) setChartError(message(error)); });
    return () => { live = false; };
  }, [datetime, settings]);
  useEffect(() => {
    if (!wheelBox.current) return;
    const measure = () => {
      if (!wheelBox.current) return;
      setSize(Math.max(240, Math.min(1000, Math.floor(wheelBox.current.clientWidth - 24), window.innerHeight - 220)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(wheelBox.current);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  const config = useMemo(() => chart ? buildConfiguration(chart, bundledPreset(preset)!.preset, 'ascendant') : null, [chart, preset]);
  const filtered = useMemo(() => charts.filter(item => `${item.name} ${item.settings.location.name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [charts, search]);
  const style = {
    '--bg': theme.color.bgSolidBase, '--panel': theme.color.bgSolidCard,
    '--text': theme.color.txPrimary, '--muted': theme.color.txSecondary,
    '--line': theme.color.bdPrimary, '--accent': theme.color.txAccent,
    colorScheme: theme.scheme,
  } as React.CSSProperties;

  async function finishSignIn(event: React.FormEvent) {
    event.preventDefault(); setSigningIn(true); setError('');
    try {
      const result = await localRequest<{ account: Account }>('sign-in', { code: code.trim() });
      download.current?.abort(); setCharts([]); setSelectedId('now'); setAccount(result.account); setCode('');
    } catch (error) { setError(message(error)); }
    finally { setSigningIn(false); }
  }

  async function signOut() {
    download.current?.abort(); setCharts([]); setSelectedId('now'); setAccount(null); setExceptions(0); setBusy(false); setStatus(''); setError('');
    try { await localRequest('sign-out', {}); }
    catch (error) { setError(message(error)); }
  }

  async function importCharts(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Choose a chart JSON file smaller than 10 MB.');
      const value = JSON.parse(await file.text());
      const incoming: SavedChart[] = Array.isArray(value) ? value : value.saved;
      if (!Array.isArray(incoming) || incoming.length > 10000) throw new Error('Choose an Expo chart JSON array or saved session.');
      incoming.forEach(chart => { validateDraft(chart); if (typeof chart.id !== 'string' || !chart.id) throw new Error('A chart has no identity.'); });
      setCharts(current => [...new Map([...current, ...incoming].map(chart => [chart.id, chart])).values()]);
      setStatus(`Opened ${incoming.length} local charts.`); setError('');
    } catch (error) { setError(message(error)); }
    event.target.value = '';
  }

  return <div className="desktop" style={style}>
    <aside className="library" aria-label="Chart library">
      <header className="brand"><span>Kairōs</span><span className="mono">CHARTS</span></header>
      <div className="library-tools">
        <input type="search" aria-label="Search charts" placeholder="Find a chart…" value={search} onChange={event => setSearch(event.target.value)} />
        <button className={`chart-row ${selectedId === 'now' ? 'selected' : ''}`} onClick={() => { setSelectedId('now'); setNow(new Date().toISOString()); }}>
          <span>The sky now</span><small>{DEFAULT_SETTINGS.location.name}</small>
        </button>
        <div className="section-label mono">YOUR CHARTS <span>{charts.length}</span></div>
      </div>
      <nav className="chart-list" aria-label="Saved charts">
        {filtered.map(item => <button key={item.id} aria-current={selectedId === item.id ? 'true' : undefined} className={`chart-row ${selectedId === item.id ? 'selected' : ''}`} onClick={() => setSelectedId(item.id)}>
          <span>{item.metadata?.favorite ? '☆ ' : ''}{item.name}</span><small>{item.settings.location.name} · {item.datetime.slice(0, 10)}</small>
        </button>)}
        {!busy && !filtered.length && <p className="empty">{search ? 'No matching charts.' : account ? 'No charts loaded yet.' : 'Sign in below to open your account charts.'}</p>}
      </nav>
      <footer className="account">
        {account ? <><div className="account-name">@{account.handle}</div><div className="button-row"><button disabled={busy} onClick={() => void refresh()}>Refresh charts</button><button onClick={() => void signOut()}>Sign out</button></div></> : <details open>
          <summary>Your account</summary>
          <p>Enter your handle, sign in, then paste the one-time code here.</p>
          <input aria-label="Account handle" placeholder="you.bsky.social" autoComplete="username" value={handle} onChange={event => setHandle(event.target.value)} />
          <a className="button-link" aria-disabled={!handle.trim()} href={handle.trim() ? `https://api.kairos.solar/oauth/start?cli=1&handle=${encodeURIComponent(handle.trim().replace(/^@/, ''))}` : undefined} target="_blank" rel="noreferrer">Open sign-in ↗</a>
          <form onSubmit={event => void finishSignIn(event)}><input aria-label="One-time sign-in code" placeholder="Paste code" autoComplete="off" value={code} onChange={event => setCode(event.target.value)} /><button disabled={!ready || !code.trim() || signingIn} type="submit">{signingIn ? 'Signing in…' : 'Load my charts'}</button></form>
        </details>}
        <label className="import-link">Open chart JSON<input type="file" accept=".json,application/json" onChange={event => void importCharts(event)} /></label>
      </footer>
    </aside>
    <main className="workspace">
      <header className="workspace-header"><div><div className="mono eyebrow">{selected ? 'SAVED CHART' : 'LIVE SKY'}</div><h1>{selected?.name ?? 'The sky now'}</h1><p>{settings.location.name} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short', timeZone: settings.location.timezone }).format(new Date(datetime))} <span className="timezone">{settings.location.timezone}</span></p></div>
        <div className="view-controls"><label>Appearance<select aria-label="Appearance" value={appearance?.mode ?? 'auto'} onChange={event => appearance?.setMode(event.target.value as 'auto' | 'dark' | 'light')}><option value="auto">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Wheel style<select aria-label="Wheel style" value={preset} onChange={event => setPreset(event.target.value)}>{BUNDLED_PRESET_NAMES.map(name => <option key={name} value={name}>{name[0].toUpperCase() + name.slice(1)}</option>)}</select></label></div>
      </header>
      {status && <div role="status" className="notice">{status}</div>}
      {error && <div role="alert" className="notice error">{error}</div>}
      {exceptions > 0 && <div className="notice">{exceptions} preserved charts need compatibility review in the app.</div>}
      <section className="chart-stage" aria-label="Chart wheel" ref={wheelBox}>
        {chartError ? <div role="alert" className="chart-message">{chartError}</div> : config ? <ChartWheel config={config} size={size} /> : <div className="chart-message" role="status">Calculating chart…</div>}
      </section>
      {chart && <details className="positions"><summary>Planetary positions</summary><table><thead><tr><th>Body</th><th>Longitude</th><th>Daily motion</th></tr></thead><tbody>{chart.celestial.nodes.filter(node => node.node_type !== 'fixed_star').map(node => <tr key={node.id}><td>{node.body}</td><td>{node.position.longitude.toFixed(3)}°</td><td>{node.position.speed_longitude.toFixed(3)}°{node.position.speed_longitude < 0 ? ' ℞' : ''}</td></tr>)}</tbody></table></details>}
    </main>
  </div>;
}
