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
import './desktop.css';

const WEB_DEFAULT_SETTINGS = { ...DEFAULT_SETTINGS, houseSystem: 'Whole Sign' as const };

const message = (error: unknown) => error instanceof Error ? error.message : String(error);

export function DesktopApp() {
  const [loaded, error] = useFonts(fontMap);
  if (!loaded && !error) return <div className="starting">Opening Kairōs…</div>;
  return <ThemeModeProvider><DesktopCharts /></ThemeModeProvider>;
}

function DesktopCharts() {
  const theme = useTheme();
  const appearance = useThemeMode();
  const [charts, setCharts] = useState<SavedChart[]>([]);
  const [selectedId, setSelectedId] = useState('now');
  const [search, setSearch] = useState('');
  const [preset, setPreset] = useState('classic');
  const [angles, setAngles] = useState<'glyphs' | 'inner' | 'zodiac' | 'outside'>('glyphs');
  const [now, setNow] = useState(() => new Date().toISOString());
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const wheelBox = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(640);
  const [chart, setChart] = useState<ChartCalculationResponse | null>(null);
  const [chartError, setChartError] = useState('');

  const selected = charts.find(item => item.id === selectedId);
  const datetime = selected?.datetime ?? now;
  const settings = selected?.settings ?? WEB_DEFAULT_SETTINGS;
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

  const config = useMemo(() => {
    if (!chart) return null;
    const display = bundledPreset(preset)!.preset;
    return buildConfiguration(chart, { ...display, angleOverlay: { enabled: angles !== 'glyphs', labels: angles === 'glyphs' ? 'outside' : angles }, aspects: { ...display.aspects, showPatterns: false } }, 'ascendant');
  }, [chart, preset, angles]);
  const filtered = useMemo(() => charts.filter(item => `${item.name} ${item.settings.location.name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())), [charts, search]);
  const style = {
    '--bg': theme.color.bgSolidBase, '--panel': theme.color.bgSolidCard,
    '--text': theme.color.txPrimary, '--muted': theme.color.txSecondary,
    '--line': theme.color.bdPrimary, '--accent': theme.color.txAccent,
    colorScheme: theme.scheme,
  } as React.CSSProperties;

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
        {!filtered.length && <p className="empty">{search ? 'No matching charts.' : 'Open a chart JSON file to view your charts.'}</p>}
      </nav>
      <footer className="account">
        <p>Login coming soon</p>
        <label className="import-link">Open chart JSON<input type="file" accept=".json,application/json" onChange={event => void importCharts(event)} /></label>
      </footer>
    </aside>
    <main className="workspace">
      <header className="workspace-header"><div><div className="mono eyebrow">{selected ? 'SAVED CHART' : 'LIVE SKY'}</div><h1>{selected?.name ?? 'The sky now'}</h1><p>{settings.location.name} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short', timeZone: settings.location.timezone }).format(new Date(datetime))} <span className="timezone">{settings.location.timezone}</span></p></div>
        <div className="view-controls"><label>Angles<select aria-label="Angles" value={angles} onChange={event => setAngles(event.target.value as typeof angles)}><option value="glyphs">Planet glyphs</option><option value="inner">Lines · inner labels</option><option value="zodiac">Lines · zodiac labels</option><option value="outside">Lines · outside labels</option></select></label><label>Appearance<select aria-label="Appearance" value={appearance?.mode ?? 'auto'} onChange={event => appearance?.setMode(event.target.value as 'auto' | 'dark' | 'light')}><option value="auto">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Wheel style<select aria-label="Wheel style" value={preset} onChange={event => setPreset(event.target.value)}>{BUNDLED_PRESET_NAMES.map(name => <option key={name} value={name}>{name[0].toUpperCase() + name.slice(1)}</option>)}</select></label></div>
      </header>
      {status && <div role="status" className="notice">{status}</div>}
      {error && <div role="alert" className="notice error">{error}</div>}
      <section className="chart-stage" aria-label="Chart wheel" ref={wheelBox}>
        {chartError ? <div role="alert" className="chart-message">{chartError}</div> : config ? <ChartWheel config={config} size={size} /> : <div className="chart-message" role="status">Calculating chart…</div>}
      </section>
    </main>
  </div>;
}
