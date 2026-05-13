'use client';

import Script from 'next/script';
import { useEffect, useMemo, useRef, useState } from 'react';

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
type Project     = { id: string; name: string };
type Environment = { id: string; name: string; projectId: string };
type EnvVar      = { id: string; key: string; value: string; updatedAt?: string; createdAt?: string };
type Tab         = 'variables' | 'add' | 'import';
type AlertKind   = 'error' | 'success' | 'info';

/* ─────────────────────────────────────────────
   ENV / GOOGLE
───────────────────────────────────────────── */
const API_BASE          = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const GOOGLE_CLIENT_ID  = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const TOKEN_KEY         = 'envops_access_token';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: { client_id: string; callback: (r: { credential?: string }) => void }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
        };
      };
    };
  }
}

function apiBase() {
  const t = API_BASE.trim().replace(/\/+$/, '');
  if (!t) throw new Error('NEXT_PUBLIC_API_BASE_URL is not set.');
  return t;
}

async function apiFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  if (!token) throw new Error('Not authenticated.');
  const res  = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  if (!res.ok) {
    const msg = (data as { message?: string | string[] } | null)?.message;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : (msg ?? res.statusText));
  }
  return data as T;
}

function fmtDate(v?: string) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseDotEnv(raw: string): { key: string; value: string }[] {
  return raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      const key = l.slice(0, idx).trim();
      let   val = l.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      return { key, value: val };
    })
    .filter(e => !!e.key);
}

/* ─────────────────────────────────────────────
   DESIGN TOKENS  (no global CSS needed)
───────────────────────────────────────────── */
const C = {
  bg:           'var(--color-bg, #ffffff)',
  bgSurface:    'var(--color-bg-surface, #f8f8f7)',
  bgMuted:      'var(--color-bg-muted, #f1f0ee)',
  border:       'var(--color-border, rgba(0,0,0,0.10))',
  borderStrong: 'var(--color-border-strong, rgba(0,0,0,0.18))',
  text:         'var(--color-text, #111110)',
  textMuted:    'var(--color-text-muted, #78746d)',
  textSubtle:   'var(--color-text-subtle, #a8a29e)',
  accent:       '#2563eb',
  accentBg:     '#eff6ff',
  accentBorder: '#bfdbfe',
  accentText:   '#1d4ed8',
  green:        '#15803d',
  greenBg:      '#f0fdf4',
  greenBorder:  '#bbf7d0',
  amber:        '#92400e',
  amberBg:      '#fffbeb',
  amberBorder:  '#fde68a',
  red:          '#b91c1c',
  redBg:        '#fef2f2',
  redBorder:    '#fecaca',
  purple:       '#5b21b6',
  purpleBg:     '#f5f3ff',
  purpleBorder: '#ddd6fe',
  mono:         "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace",
  sans:         "'DM Sans', 'Instrument Sans', ui-sans-serif, system-ui, sans-serif",
  radius:       '8px',
  radiusLg:     '12px',
  radiusXl:     '16px',
  shadow:       '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05)',
  shadowMd:     '0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04)',
} as const;

/* ─────────────────────────────────────────────
   PRIMITIVE UI COMPONENTS
───────────────────────────────────────────── */

/* Badge */
type BadgeVariant = 'default' | 'blue' | 'green' | 'amber' | 'red' | 'purple';
function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  const map: Record<BadgeVariant, React.CSSProperties> = {
    default: { background: C.bgMuted,    color: C.textMuted,  border: `0.5px solid ${C.border}` },
    blue:    { background: C.accentBg,   color: C.accentText, border: `0.5px solid ${C.accentBorder}` },
    green:   { background: C.greenBg,    color: C.green,      border: `0.5px solid ${C.greenBorder}` },
    amber:   { background: C.amberBg,    color: C.amber,      border: `0.5px solid ${C.amberBorder}` },
    red:     { background: C.redBg,      color: C.red,        border: `0.5px solid ${C.redBorder}` },
    purple:  { background: C.purpleBg,   color: C.purple,     border: `0.5px solid ${C.purpleBorder}` },
  };
  return (
    <span style={{
      ...map[variant],
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 500,
      whiteSpace: 'nowrap',
      fontFamily: C.sans,
    }}>
      {children}
    </span>
  );
}

/* Button */
type BtnVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'destructive';
type BtnSize    = 'sm' | 'md' | 'lg';
function Btn({
  children, onClick, variant = 'outline', size = 'md', disabled = false, style = {}, type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  size?: BtnSize;
  disabled?: boolean;
  style?: React.CSSProperties;
  type?: 'button' | 'submit';
}) {
  const base: React.CSSProperties = {
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: C.sans,
    fontWeight: 500,
    borderRadius: C.radius,
    border: '1px solid',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    opacity: disabled ? 0.45 : 1,
    whiteSpace: 'nowrap',
    transition: 'opacity 0.12s, background 0.12s, transform 0.1s',
    userSelect: 'none',
  };
  const sizes: Record<BtnSize, React.CSSProperties> = {
    sm: { padding: '4px 10px', fontSize: 12 },
    md: { padding: '7px 14px', fontSize: 13 },
    lg: { padding: '10px 20px', fontSize: 14 },
  };
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary:     { background: C.text,      color: C.bg,        borderColor: C.text },
    secondary:   { background: C.bgSurface, color: C.text,      borderColor: C.border },
    outline:     { background: 'transparent', color: C.text,    borderColor: C.borderStrong },
    ghost:       { background: 'transparent', color: C.textMuted, borderColor: 'transparent' },
    danger:      { background: C.redBg,     color: C.red,       borderColor: C.redBorder },
    destructive: { background: '#dc2626',   color: '#fff',      borderColor: '#dc2626' },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

/* Input */
function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && (
        <label style={{ fontSize: 11, fontWeight: 500, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: C.sans }}>
          {label}
        </label>
      )}
      <input {...rest} style={{
        width: '100%', fontFamily: rest.readOnly ? C.mono : C.sans, fontSize: 13,
        background: C.bg, color: C.text,
        border: `1px solid ${C.border}`, borderRadius: C.radius,
        padding: '7px 10px', outline: 'none',
        transition: 'border-color 0.15s',
        boxSizing: 'border-box',
        ...style,
      }}
        onFocus={e => { e.currentTarget.style.borderColor = C.accent; }}
        onBlur={e  => { e.currentTarget.style.borderColor = C.border; }}
      />
    </div>
  );
}

/* Textarea */
function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} style={{
      width: '100%', fontFamily: C.mono, fontSize: 12,
      background: C.bg, color: C.text,
      border: `1px solid ${C.border}`, borderRadius: C.radius,
      padding: '8px 10px', outline: 'none', resize: 'vertical',
      minHeight: 110, lineHeight: 1.6,
      transition: 'border-color 0.15s',
      boxSizing: 'border-box',
      ...props.style,
    }}
      onFocus={e => { e.currentTarget.style.borderColor = C.accent; }}
      onBlur={e  => { e.currentTarget.style.borderColor = C.border; }}
    />
  );
}

/* Select */
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} style={{
      width: '100%', fontFamily: C.sans, fontSize: 13,
      background: C.bg, color: C.text,
      border: `1px solid ${C.border}`, borderRadius: C.radius,
      padding: '7px 30px 7px 10px', outline: 'none',
      appearance: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2378746d'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'right 10px center',
      boxSizing: 'border-box',
      transition: 'border-color 0.15s',
      ...props.style,
    }}
      onFocus={e => { e.currentTarget.style.borderColor = C.accent; }}
      onBlur={e  => { e.currentTarget.style.borderColor = C.border; }}
    />
  );
}

/* Card */
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.bg,
      border: `1px solid ${C.border}`,
      borderRadius: C.radiusLg,
      overflow: 'hidden',
      boxShadow: C.shadow,
      ...style,
    }}>
      {children}
    </div>
  );
}

function CardHeader({
  title, desc, action,
}: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div style={{
      padding: '14px 16px',
      borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    }}>
      <div>
        <p style={{ fontWeight: 500, fontSize: 14, color: C.text, fontFamily: C.sans }}>{title}</p>
        {desc && <p style={{ fontSize: 12, color: C.textMuted, marginTop: 2, fontFamily: C.sans }}>{desc}</p>}
      </div>
      {action}
    </div>
  );
}

function CardBody({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ padding: '14px 16px', ...style }}>{children}</div>;
}

/* Alert */
function AlertBanner({ message, kind }: { message: string; kind: AlertKind }) {
  const cfg: Record<AlertKind, React.CSSProperties> = {
    error:   { background: C.redBg,    color: C.red,        border: `1px solid ${C.redBorder}` },
    success: { background: C.greenBg,  color: C.green,      border: `1px solid ${C.greenBorder}` },
    info:    { background: C.accentBg, color: C.accentText, border: `1px solid ${C.accentBorder}` },
  };
  return (
    <div style={{ ...cfg[kind], borderRadius: C.radius, padding: '9px 12px', fontSize: 13, marginBottom: 12, fontFamily: C.sans }}>
      {message}
    </div>
  );
}

/* Divider */
function Divider({ style = {} }: { style?: React.CSSProperties }) {
  return <div style={{ height: 1, background: C.border, margin: '10px 0', ...style }} />;
}

/* EnvBadge */
function EnvBadge({ name }: { name: string }) {
  const map: Record<string, BadgeVariant> = { production: 'red', staging: 'amber', development: 'green' };
  return <Badge variant={map[name?.toLowerCase()] ?? 'default'}>{name}</Badge>;
}

/* Avatar */
function Avatar({ email }: { email: string }) {
  const initials = email.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: C.purpleBg, color: C.purple,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 600, flexShrink: 0, fontFamily: C.sans,
      border: `1px solid ${C.purpleBorder}`,
    }}>
      {initials}
    </div>
  );
}

/* EyeIcon */
function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 7s2.5-4.5 6-4.5S13 7 13 7s-2.5 4.5-6 4.5S1 7 1 7z" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.2" />
      <line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 7s2.5-4.5 6-4.5S13 7 13 7s-2.5 4.5-6 4.5S1 7 1 7z" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="7" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/* CopyIcon */
function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3 9H2a1 1 0 01-1-1V2a1 1 0 011-1h6a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/* TrashIcon */
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M1.5 3.5h10M4.5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1M5.5 6v4M7.5 6v4M2.5 3.5l.6 7a1 1 0 001 .9h4.8a1 1 0 001-.9l.6-7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

/* PencilIcon */
function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M8.5 2l2.5 2.5-7 7H1.5V9l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   MAIN PAGE COMPONENT
───────────────────────────────────────────── */
export default function Home() {
  /* ── Auth ── */
  const [googleReady,  setGoogleReady]  = useState(false);
  const [accessToken,  setAccessToken]  = useState('');
  const [userEmail,    setUserEmail]    = useState('');

  /* ── Data ── */
  const [projects,     setProjects]     = useState<Project[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [variables,    setVariables]    = useState<EnvVar[]>([]);

  /* ── Selection ── */
  const [selProjectId, setSelProjectId] = useState('');
  const [selEnvId,     setSelEnvId]     = useState('');

  /* ── Forms ── */
  const [newProjName,  setNewProjName]  = useState('');
  const [editingVar,   setEditingVar]   = useState<EnvVar | null>(null);
  const [keyInput,     setKeyInput]     = useState('');
  const [valInput,     setValInput]     = useState('');
  const [bulkText,     setBulkText]     = useState('');

  /* ── UI state ── */
  const [activeTab,    setActiveTab]    = useState<Tab>('variables');
  const [search,       setSearch]       = useState('');
  const [revealed,     setRevealed]     = useState<Record<string, boolean>>({});
  const [copied,       setCopied]       = useState<string | null>(null);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');
  const [loading,      setLoading]      = useState(false);
  const [varLoading,   setVarLoading]   = useState(false);
  const [importing,    setImporting]    = useState(false);

  /* ── Derived ── */
  const selProject = useMemo(() => projects.find(p => p.id === selProjectId), [projects, selProjectId]);
  const selEnvName = useMemo(() => environments.find(e => e.id === selEnvId)?.name ?? '', [environments, selEnvId]);
  const filteredVars = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? variables.filter(v => v.key.toLowerCase().includes(q)) : variables;
  }, [variables, search]);
  const bulkCount = useMemo(() => parseDotEnv(bulkText).length, [bulkText]);

  /* ── Helpers ── */
  function flash(msg: string, kind: AlertKind = 'success') {
    kind === 'success' ? setSuccess(msg) : setError(msg);
    setTimeout(() => { setSuccess(''); setError(''); }, 2600);
  }

  async function run(fn: () => Promise<void>) {
    setLoading(true); setError('');
    try   { await fn(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unexpected error'); }
    finally   { setLoading(false); }
  }

  async function copyText(val: string, id: string) {
    await navigator.clipboard.writeText(val);
    setCopied(id);
    setTimeout(() => setCopied(c => c === id ? null : c), 1400);
  }

  /* ── Lifecycle ── */
  useEffect(() => {
    const t = window.localStorage.getItem(TOKEN_KEY);
    if (t) setAccessToken(t);
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    window.localStorage.setItem(TOKEN_KEY, accessToken);
    void loadProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (!googleReady || !!accessToken || !GOOGLE_CLIENT_ID || !window.google) return;
    const el = document.getElementById('google-signin-btn');
    if (!el) return;
    el.innerHTML = '';
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: r => r.credential && void handleGoogleCredential(r.credential),
    });
    window.google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', text: 'signin_with' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleReady, accessToken]);

  useEffect(() => {
    if (selProjectId) void loadEnvironments(selProjectId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selProjectId]);

  useEffect(() => {
    if (selProjectId && selEnvId) void loadVariables(selProjectId, selEnvId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selProjectId, selEnvId]);

  /* ── API calls ── */
  async function loadProjects() {
    await run(async () => {
      const list = await apiFetch<Project[]>('/projects', accessToken);
      setProjects(list);
      if (!selProjectId && list.length > 0) setSelProjectId(list[0].id);
    });
  }

  async function loadEnvironments(projectId: string) {
    await run(async () => {
      const list = await apiFetch<Environment[]>(`/projects/${projectId}/environments`, accessToken);
      setEnvironments(list);
      if (!list.find(e => e.id === selEnvId)) setSelEnvId(list[0]?.id ?? '');
    });
  }

  async function loadVariables(projectId: string, environmentId: string) {
    setVarLoading(true);
    try {
      await run(async () => {
        const list = await apiFetch<EnvVar[]>(
          `/env?projectId=${encodeURIComponent(projectId)}&environmentId=${encodeURIComponent(environmentId)}`,
          accessToken,
        );
        setVariables(list);
        setRevealed({});
      });
    } finally {
      setVarLoading(false);
    }
  }

  async function createProject() {
    if (!newProjName.trim()) return;
    await run(async () => {
      await apiFetch('/projects', accessToken, { method: 'POST', body: JSON.stringify({ name: newProjName.trim() }) });
      setNewProjName('');
      await loadProjects();
    });
  }

  async function deleteProject(id: string) {
    if (!confirm('Delete this project and all its variables?')) return;
    await run(async () => {
      await apiFetch(`/projects/${id}`, accessToken, { method: 'DELETE' });
      if (selProjectId === id) { setSelProjectId(''); setSelEnvId(''); setVariables([]); }
      await loadProjects();
    });
  }

  async function saveVariable() {
    if (!selProjectId || !selEnvId || !keyInput.trim()) return;
    await run(async () => {
      if (editingVar) {
        await apiFetch(`/env/${editingVar.id}`, accessToken, {
          method: 'PUT', body: JSON.stringify({ key: keyInput.trim(), value: valInput }),
        });
        flash('Variable updated.');
      } else {
        await apiFetch('/env', accessToken, {
          method: 'POST',
          body: JSON.stringify({ key: keyInput.trim(), value: valInput, projectId: selProjectId, environmentId: selEnvId }),
        });
        flash('Variable created.');
      }
      setEditingVar(null); setKeyInput(''); setValInput('');
      await loadVariables(selProjectId, selEnvId);
      setActiveTab('variables');
    });
  }

  async function deleteVariable(id: string) {
    if (!confirm('Delete this variable?')) return;
    await run(async () => {
      await apiFetch(`/env/${id}`, accessToken, { method: 'DELETE' });
      flash('Variable deleted.');
      await loadVariables(selProjectId, selEnvId);
    });
  }

  async function deleteAllVariables() {
    if (!selProjectId || !selEnvId) return;
    if (!confirm(`Delete ALL variables in "${selEnvName}"? This cannot be undone.`)) return;
    await run(async () => {
      const res = await apiFetch<{ deletedCount?: number }>(
        `/env?projectId=${encodeURIComponent(selProjectId)}&environmentId=${encodeURIComponent(selEnvId)}`,
        accessToken, { method: 'DELETE' },
      );
      flash(`Deleted ${res?.deletedCount ?? 0} variables from ${selEnvName}.`);
      await loadVariables(selProjectId, selEnvId);
    });
  }

  async function importBulk() {
    if (!selProjectId || !selEnvId || !bulkText.trim()) return;
    setImporting(true);
    try {
      await run(async () => {
        const entries = parseDotEnv(bulkText);
        if (!entries.length) throw new Error('No valid KEY=VALUE entries found.');
        const existing = await apiFetch<EnvVar[]>(
          `/env?projectId=${encodeURIComponent(selProjectId)}&environmentId=${encodeURIComponent(selEnvId)}`,
          accessToken,
        );
        const byKey = new Map(existing.map(v => [v.key, v]));
        for (const entry of entries) {
          const ex = byKey.get(entry.key);
          if (ex) {
            await apiFetch(`/env/${ex.id}`, accessToken, { method: 'PUT', body: JSON.stringify({ value: entry.value }) });
          } else {
            await apiFetch('/env', accessToken, {
              method: 'POST',
              body: JSON.stringify({ key: entry.key, value: entry.value, projectId: selProjectId, environmentId: selEnvId }),
            });
          }
        }
        setBulkText('');
        flash(`Imported ${entries.length} variable${entries.length !== 1 ? 's' : ''}.`);
        await loadVariables(selProjectId, selEnvId);
        setActiveTab('variables');
      });
    } finally {
      setImporting(false);
    }
  }

  async function handleGoogleCredential(googleIdToken: string) {
    await run(async () => {
      const res = await fetch(`${apiBase()}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleIdToken }),
      });
      const payload = await res.json() as { accessToken?: string; user?: { email?: string }; message?: string | string[] };
      if (!res.ok || !payload.accessToken) {
        const m = payload.message;
        throw new Error(Array.isArray(m) ? m.join(', ') : (m ?? 'Google sign-in failed'));
      }
      setAccessToken(payload.accessToken);
      setUserEmail(payload.user?.email ?? '');
    });
  }

  function signOut() {
    setAccessToken(''); setUserEmail('');
    setProjects([]); setEnvironments([]); setVariables([]);
    setSelProjectId(''); setSelEnvId('');
    window.localStorage.removeItem(TOKEN_KEY);
  }

  function startEdit(v: EnvVar) {
    setEditingVar(v); setKeyInput(v.key); setValInput('');
    setActiveTab('add');
  }

  function cancelEdit() {
    setEditingVar(null); setKeyInput(''); setValInput('');
  }

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bgSurface, fontFamily: C.sans }}>

      {/* Google GSI */}
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={() => setGoogleReady(true)} />

      {/* ── SIDEBAR ─────────────────────────────── */}
      <aside style={{
        width: 224, minHeight: '100vh', flexShrink: 0,
        background: C.bg, borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Brand */}
        <div style={{
          padding: '16px 16px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: C.text,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="3" width="12" height="9" rx="1.5" stroke={C.bg} strokeWidth="1.3" />
              <path d="M4.5 3V2.5A1.5 1.5 0 016 1h2a1.5 1.5 0 011.5 1.5V3" stroke={C.bg} strokeWidth="1.3" />
              <line x1="4" y1="7" x2="7" y2="7" stroke={C.bg} strokeWidth="1.1" strokeLinecap="round" />
              <line x1="4" y1="9.5" x2="9" y2="9.5" stroke={C.bg} strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>EnvOps</p>
            <p style={{ fontSize: 11, color: C.textSubtle, lineHeight: 1.2 }}>Control Plane</p>
          </div>
        </div>

        {/* Projects list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
          <p style={{
            fontSize: 10, fontWeight: 600, color: C.textSubtle,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            padding: '4px 6px', marginBottom: 6,
          }}>
            Projects
          </p>

          {projects.map(p => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 2,
              borderRadius: C.radius,
              background: p.id === selProjectId ? C.bgMuted : 'transparent',
              marginBottom: 1, padding: '1px 2px',
            }}>
              <button onClick={() => setSelProjectId(p.id)} style={{
                flex: 1, textAlign: 'left',
                padding: '6px 8px', background: 'none', border: 'none', cursor: 'pointer',
                borderRadius: C.radius,
                fontWeight: p.id === selProjectId ? 500 : 400,
                color: p.id === selProjectId ? C.text : C.textMuted,
                fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: C.sans,
              }}>
                {p.name}
              </button>
              <button onClick={() => void deleteProject(p.id)} style={{
                padding: '4px 5px', background: 'none', border: 'none', cursor: 'pointer',
                color: C.textSubtle, borderRadius: 4, lineHeight: 1, opacity: 0.6,
              }}>
                <svg width="9" height="9" viewBox="0 0 9 9">
                  <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))}

          {projects.length === 0 && (
            <p style={{ fontSize: 12, color: C.textSubtle, padding: '8px 6px' }}>No projects yet.</p>
          )}

          <Divider style={{ margin: '12px 0' }} />

          {/* Add project */}
          <div style={{ padding: '0 2px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              placeholder="project-name"
              value={newProjName}
              onChange={e => setNewProjName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void createProject()}
              style={{
                width: '100%', fontFamily: C.sans, fontSize: 12,
                background: C.bgSurface, color: C.text,
                border: `1px solid ${C.border}`, borderRadius: C.radius,
                padding: '6px 9px', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <Btn onClick={() => void createProject()} variant="outline" size="sm" style={{ width: '100%' }}>
              + Add Project
            </Btn>
          </div>
        </div>

        {/* User footer */}
        {accessToken && (
          <div style={{
            padding: '12px 14px',
            borderTop: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <Avatar email={userEmail || 'U'} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userEmail || 'Authenticated'}
              </p>
              <p style={{ fontSize: 11, color: C.textSubtle }}>Signed in</p>
            </div>
            <button onClick={signOut} title="Sign out" style={{
              background: 'none', border: 'none', cursor: 'pointer', color: C.textSubtle, padding: 3, borderRadius: 4,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2.5H11.5v9H9M5.5 5L3 7l2.5 2.5M3 7h7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </aside>

      {/* ── MAIN ─────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Topbar */}
        <header style={{
          background: C.bg, borderBottom: `1px solid ${C.border}`,
          padding: '0 24px', height: 52,
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {selProject && (
              <p style={{ fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap' }}>{selProject.name}</p>
            )}
            {selProject && selEnvName && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4 2l4 4-4 4" stroke={C.textSubtle} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {selEnvName && <EnvBadge name={selEnvName} />}
            {variables.length > 0 && (
              <Badge variant="purple">{variables.length} var{variables.length !== 1 ? 's' : ''}</Badge>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {environments.length > 0 && (
              <Select
                value={selEnvId}
                onChange={e => setSelEnvId(e.target.value)}
                style={{ width: 'auto', padding: '5px 28px 5px 10px', fontSize: 12 }}
              >
                <option value="">Select environment</option>
                {environments.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </Select>
            )}
            {!accessToken && (
              <div id="google-signin-btn" />
            )}
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {error   && <AlertBanner message={error}   kind="error"   />}
          {success && <AlertBanner message={success} kind="success" />}

          {/* ── Not authed ── */}
          {!accessToken && (
            <Card>
              <CardHeader title="Authentication required" desc="Sign in with Google to manage your environment variables." />
              <CardBody>
                {!GOOGLE_CLIENT_ID && (
                  <AlertBanner message="NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set in your environment." kind="error" />
                )}
                <div style={{ paddingTop: 8 }}>
                  <div id="google-signin-btn" />
                </div>
              </CardBody>
            </Card>
          )}

          {/* ── Authed ── */}
          {accessToken && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Row 1: Token + Workspace */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Card>
                  <CardHeader title="Access token" desc="Bearer token for API requests." />
                  <CardBody>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        readOnly value={accessToken}
                        style={{
                          flex: 1, fontFamily: C.mono, fontSize: 11,
                          color: C.textMuted, background: C.bgSurface,
                          border: `1px solid ${C.border}`, borderRadius: C.radius,
                          padding: '6px 9px', outline: 'none', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      />
                      <Btn onClick={() => void copyText(accessToken, '__tok')} variant="outline" size="sm">
                        {copied === '__tok' ? '✓ Copied' : 'Copy'}
                      </Btn>
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="Workspace" desc="Active project and environment." />
                  <CardBody>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                      {selProject ? (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 10px',
                          background: C.bgMuted, borderRadius: C.radius,
                          border: `1px solid ${C.border}`,
                        }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#15803d' }} />
                          <span style={{ fontSize: 12, fontWeight: 500 }}>{selProject.name}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: C.textSubtle }}>No project selected</span>
                      )}
                      {selEnvName && <EnvBadge name={selEnvName} />}
                    </div>
                  </CardBody>
                </Card>
              </div>

              {/* Row 2: Main tabbed card */}
              {selProjectId && (
                <Card>
                  {/* Tab bar */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 0,
                    padding: '0 16px', borderBottom: `1px solid ${C.border}`,
                  }}>
                    {([ ['variables', 'Variables'], ['add', editingVar ? 'Edit variable' : 'Add variable'], ['import', 'Bulk import'] ] as [Tab, string][]).map(([id, label]) => (
                      <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        style={{
                          padding: '12px 12px',
                          fontSize: 13, fontWeight: activeTab === id ? 500 : 400,
                          color: activeTab === id ? C.text : C.textMuted,
                          background: 'none', border: 'none', cursor: 'pointer',
                          borderBottom: activeTab === id ? `2px solid ${C.text}` : '2px solid transparent',
                          fontFamily: C.sans, transition: 'all 0.12s',
                          marginBottom: -1,
                        }}
                      >
                        {label}
                        {id === 'variables' && variables.length > 0 && (
                          <span style={{
                            marginLeft: 6, fontSize: 10, fontWeight: 500,
                            background: C.bgMuted, color: C.textMuted,
                            padding: '1px 6px', borderRadius: 999,
                            border: `0.5px solid ${C.border}`,
                          }}>
                            {variables.length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* ── Tab: Variables ── */}
                  {activeTab === 'variables' && (
                    <div>
                      {/* Toolbar */}
                      <div style={{
                        padding: '10px 16px', borderBottom: `1px solid ${C.border}`,
                        display: 'flex', gap: 8, alignItems: 'center',
                      }}>
                        <input
                          placeholder="Search keys…"
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          style={{
                            flex: 1, fontFamily: C.sans, fontSize: 13,
                            background: C.bgSurface, color: C.text,
                            border: `1px solid ${C.border}`, borderRadius: C.radius,
                            padding: '6px 10px', outline: 'none',
                          }}
                        />
                        <Btn
                          onClick={() => { cancelEdit(); setActiveTab('add'); }}
                          variant="primary" size="sm"
                        >
                          + New variable
                        </Btn>
                        {variables.length > 0 && (
                          <Btn
                            onClick={() => void deleteAllVariables()}
                            variant="danger" size="sm"
                            disabled={!selEnvId || loading}
                          >
                            Delete all
                          </Btn>
                        )}
                      </div>

                      {/* Variable rows */}
                      {varLoading ? (
                        <div style={{ padding: '32px 16px', textAlign: 'center', color: C.textSubtle, fontSize: 13 }}>
                          Loading variables…
                        </div>
                      ) : filteredVars.length === 0 ? (
                        <div style={{ padding: '36px 16px', textAlign: 'center', color: C.textSubtle, fontSize: 13 }}>
                          {search ? 'No variables match your search.' : 'No variables yet. Add one to get started.'}
                        </div>
                      ) : (
                        filteredVars.map((v, i) => {
                          const isRev = !!revealed[v.id];
                          const mask  = '•'.repeat(Math.max(8, Math.min(20, v.value.length || 8)));
                          return (
                            <div key={v.id} style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr minmax(0, 240px) auto',
                              alignItems: 'center', gap: 14,
                              padding: '11px 16px',
                              borderBottom: i < filteredVars.length - 1 ? `1px solid ${C.border}` : 'none',
                              transition: 'background 0.1s',
                            }}
                              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = C.bgSurface; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                            >
                              {/* Key + meta */}
                              <div>
                                <code style={{ fontFamily: C.mono, fontSize: 12, fontWeight: 500, color: C.text }}>{v.key}</code>
                                <p style={{ fontSize: 11, color: C.textSubtle, marginTop: 2 }}>
                                  {selProject?.name} / {selEnvName} · {fmtDate(v.updatedAt ?? v.createdAt)}
                                </p>
                              </div>

                              {/* Value */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                <code style={{
                                  fontFamily: C.mono, fontSize: 11,
                                  color: isRev ? C.text : C.textSubtle,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  flex: 1,
                                }}>
                                  {isRev ? v.value : mask}
                                </code>
                                <button
                                  onClick={() => setRevealed(r => ({ ...r, [v.id]: !isRev }))}
                                  style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: C.textSubtle, padding: 3, borderRadius: 4, flexShrink: 0,
                                  }}
                                >
                                  <EyeIcon open={isRev} />
                                </button>
                              </div>

                              {/* Actions */}
                              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                <Btn onClick={() => void copyText(v.value, v.id)} variant="secondary" size="sm">
                                  {copied === v.id ? '✓' : <CopyIcon />}
                                </Btn>
                                <Btn onClick={() => startEdit(v)} variant="outline" size="sm">
                                  <PencilIcon />
                                </Btn>
                                <Btn onClick={() => void deleteVariable(v.id)} variant="danger" size="sm">
                                  <TrashIcon />
                                </Btn>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* ── Tab: Add / Edit ── */}
                  {activeTab === 'add' && (
                    <CardBody>
                      <div style={{ maxWidth: 480 }}>
                        {editingVar && (
                          <div style={{
                            marginBottom: 14,
                            padding: '8px 12px',
                            background: C.accentBg,
                            borderRadius: C.radius,
                            border: `1px solid ${C.accentBorder}`,
                            fontSize: 12, color: C.accentText,
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}>
                            <span>Editing</span>
                            <code style={{ fontFamily: C.mono, fontWeight: 600 }}>{editingVar.key}</code>
                            <button onClick={cancelEdit} style={{
                              marginLeft: 'auto', background: 'none', border: 'none',
                              cursor: 'pointer', fontSize: 11, color: C.accentText, opacity: 0.7,
                            }}>
                              Cancel edit
                            </button>
                          </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <Input
                            label="Key"
                            placeholder="DATABASE_URL"
                            value={keyInput}
                            onChange={e => setKeyInput(e.target.value)}
                            disabled={!!editingVar}
                            style={{ fontFamily: C.mono, opacity: editingVar ? 0.7 : 1 }}
                          />
                          <Input
                            label="Value"
                            placeholder={editingVar ? 'New value (leave blank to keep current)' : 'postgres://localhost:5432/mydb'}
                            value={valInput}
                            onChange={e => setValInput(e.target.value)}
                          />

                          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                            <Btn
                              onClick={() => void saveVariable()}
                              variant="primary"
                              disabled={!selEnvId || loading || !keyInput.trim()}
                            >
                              {editingVar ? 'Update variable' : 'Create variable'}
                            </Btn>
                            {editingVar && (
                              <Btn onClick={cancelEdit} variant="ghost">Cancel</Btn>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  )}

                  {/* ── Tab: Bulk import ── */}
                  {activeTab === 'import' && (
                    <CardBody>
                      <div style={{ maxWidth: 520 }}>
                        <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
                          Paste a <code style={{ fontFamily: C.mono, fontSize: 11, background: C.bgMuted, padding: '1px 5px', borderRadius: 4 }}>.env</code> file below.
                          Existing keys will be updated; new keys will be created.
                        </p>
                        <Textarea
                          placeholder={'DATABASE_URL=postgresql://...\nSTRIPE_KEY=sk_live_...\nREDIS_URL=redis://...'}
                          value={bulkText}
                          onChange={e => setBulkText(e.target.value)}
                          style={{ marginBottom: 10 }}
                        />
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Btn
                            onClick={() => void importBulk()}
                            variant="primary"
                            disabled={!selEnvId || loading || importing || !bulkText.trim()}
                          >
                            {importing ? 'Importing…' : 'Import variables'}
                          </Btn>
                          {bulkCount > 0 && (
                            <span style={{ fontSize: 12, color: C.textSubtle }}>
                              {bulkCount} entr{bulkCount !== 1 ? 'ies' : 'y'} detected
                            </span>
                          )}
                        </div>
                      </div>
                    </CardBody>
                  )}
                </Card>
              )}

              {/* No project selected */}
              {!selProjectId && (
                <Card>
                  <CardBody>
                    <p style={{ color: C.textSubtle, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
                      Select a project from the sidebar to get started.
                    </p>
                  </CardBody>
                </Card>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}