import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { AlertTriangle, CheckCircle2, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useModal } from '../components/ui/ModalContext';

/**
 * System Errors — the system watching itself. Every server failure (5xx,
 * uncaught route error, cron failure) is recorded and shown here, so
 * breakage is discovered by the admin, not reported by customers.
 */

interface ErrorRow {
  id: string;
  level: string;
  source: string;
  message: string;
  stack?: string | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  resolved: boolean;
  createdAt: string;
}

const timeAgo = (iso: string): string => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export default function SystemErrors() {
  const { showConfirm } = useModal();
  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/errors?resolved=${showResolved}`);
      setRows(res.data);
    } catch {
      /* the errors page itself failing is visible enough */
    } finally {
      setLoading(false);
    }
  }, [showResolved]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const resolve = async (id: string) => {
    await api.patch(`/errors/${id}/resolve`).catch(() => {});
    setRows(r => showResolved ? r.map(x => x.id === id ? { ...x, resolved: true } : x) : r.filter(x => x.id !== id));
  };

  const resolveAll = async () => {
    const ok = await showConfirm({
      title: 'Resolve All Errors',
      message: 'Mark every open error as resolved?',
      variant: 'info',
      confirmLabel: 'Resolve All',
    });
    if (!ok) return;
    await api.post('/errors/resolve-all').catch(() => {});
    fetchRows();
  };

  const clearResolved = async () => {
    const ok = await showConfirm({
      title: 'Delete Resolved Errors',
      message: 'Permanently delete all resolved errors?',
      variant: 'danger',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await api.delete('/errors/resolved').catch(() => {});
    fetchRows();
  };

  const open = rows.filter(r => !r.resolved).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary flex items-center gap-2">
            <AlertTriangle size={20} className={open > 0 ? 'text-gold-dark' : 'text-text-tertiary'} />
            System Errors
          </h1>
          <p className="text-sm text-text-tertiary mt-0.5">
            Server failures recorded automatically. {open > 0 ? `${open} need attention.` : 'All clear.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchRows} className="btn-secondary flex items-center gap-1.5">
            <RefreshCw size={14} /> Refresh
          </button>
          {open > 0 && (
            <button onClick={resolveAll} className="btn-primary flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Resolve all
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {[{ v: false, label: 'Open' }, { v: true, label: 'Including resolved' }].map(t => (
          <button
            key={String(t.v)}
            onClick={() => setShowResolved(t.v)}
            className={`px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
              showResolved === t.v ? 'bg-coral text-white' : 'bg-muted text-text-primary hover:bg-coral-light'
            }`}
          >
            {t.label}
          </button>
        ))}
        {showResolved && (
          <button onClick={clearResolved} className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-semibold text-danger hover:bg-danger-light rounded-lg transition-colors">
            <Trash2 size={13} /> Delete resolved
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-4 border-coral/20 border-t-coral rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card-widget p-12 text-center">
          <CheckCircle2 className="mx-auto text-gold mb-3" size={40} />
          <h3 className="text-base font-bold text-text-primary">No errors recorded</h3>
          <p className="text-sm text-text-tertiary mt-1">
            The server is healthy. When something fails, it appears here with its details.
          </p>
        </div>
      ) : (
        <div className="card-widget divide-y divide-border">
          {rows.map(row => (
            <div key={row.id} className={`px-4 py-3.5 ${row.resolved ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${row.resolved ? 'bg-text-tertiary' : 'bg-danger'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-text-primary break-words">{row.message}</p>
                  <p className="text-[11.5px] text-text-tertiary mt-1 flex flex-wrap gap-x-2">
                    <span>{timeAgo(row.createdAt)}</span>
                    <span className="uppercase font-bold text-[10px] tracking-wide bg-muted px-1.5 py-0.5 rounded">{row.source}</span>
                    {row.statusCode && <span>HTTP {row.statusCode}</span>}
                    {row.path && <span className="font-mono truncate max-w-[40ch]">{row.method} {row.path}</span>}
                  </p>
                  {expanded === row.id && row.stack && (
                    <pre className="mt-2 p-3 bg-gray-950 text-gray-200 text-[11px] leading-relaxed overflow-x-auto rounded-lg max-h-64">
                      {row.stack}
                    </pre>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {row.stack && (
                    <button
                      onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-muted text-text-secondary hover:text-text-primary transition-colors"
                      title="Show details"
                    >
                      {expanded === row.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  )}
                  {!row.resolved && (
                    <button
                      onClick={() => resolve(row.id)}
                      className="px-2.5 h-7 flex items-center gap-1 rounded-md bg-muted text-[12px] font-semibold text-text-secondary hover:bg-gold-light hover:text-gold-dark transition-colors"
                    >
                      <CheckCircle2 size={13} /> Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
