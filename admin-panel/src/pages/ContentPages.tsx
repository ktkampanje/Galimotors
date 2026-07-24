import React, { useState, useEffect } from 'react';
import { FileText, Save, Eye, Pencil, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { useModal } from '../components/ui/ModalContext';

interface PageSummary {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  updatedAt: string;
}

interface PageDetail extends PageSummary {
  content: string;
}

/**
 * Preview renderer. Mirrors the markdown-lite parser in the customer app
 * (dealership-app/src/pages/StaticPage.tsx) so what an editor sees here
 * matches what visitors get. Keep the two in step if the syntax changes.
 */
const renderInline = (text: string): React.ReactNode => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i} className="font-bold text-text-primary">{part.slice(2, -2)}</strong>
      : <React.Fragment key={i}>{part}</React.Fragment>
  );
};

const renderPreview = (content: string): React.ReactNode[] => {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];

  const flushList = () => {
    if (!list.length) return;
    blocks.push(
      <ul key={`u${blocks.length}`} className="list-disc pl-5 space-y-1 mb-4 text-text-secondary">
        {list.map((li, i) => <li key={i}>{renderInline(li)}</li>)}
      </ul>
    );
    list = [];
  };
  const flushPara = () => {
    if (!para.length) return;
    blocks.push(
      <p key={`p${blocks.length}`} className="text-text-secondary leading-relaxed mb-3">
        {renderInline(para.join(' '))}
      </p>
    );
    para = [];
  };
  const flushAll = () => { flushList(); flushPara(); };

  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) { flushAll(); continue; }
    if (line.startsWith('### ')) {
      flushAll();
      blocks.push(<h3 key={`h3${blocks.length}`} className="text-[15px] font-bold text-text-primary mt-5 mb-2">{line.slice(4)}</h3>);
      continue;
    }
    if (line.startsWith('## ')) {
      flushAll();
      blocks.push(<h2 key={`h2${blocks.length}`} className="text-[17px] font-extrabold text-text-primary mt-6 mb-2 pb-1.5 border-b border-border first:mt-0">{line.slice(3)}</h2>);
      continue;
    }
    if (line.startsWith('- ')) { flushPara(); list.push(line.slice(2)); continue; }
    if (line.startsWith('_') && line.endsWith('_') && line.length > 2) {
      flushAll();
      blocks.push(<p key={`e${blocks.length}`} className="text-[12px] italic text-text-tertiary mb-4">{line.slice(1, -1)}</p>);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushAll();
  return blocks;
};

const countTodos = (content: string) => (content.match(/\[TODO:/g) || []).length;

const ContentPages: React.FC = () => {
  const { showAlert } = useModal();
  const [pages, setPages] = useState<PageSummary[]>([]);
  const [active, setActive] = useState<PageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');

  const [form, setForm] = useState({ title: '', subtitle: '', content: '' });
  const [dirty, setDirty] = useState(false);

  const fetchPages = async () => {
    try {
      setLoading(true);
      const res = await api.get('/pages');
      setPages(res.data);
      if (res.data.length && !active) void openPage(res.data[0].slug);
    } catch {
      await showAlert({ title: 'Error', message: 'Failed to load pages', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const openPage = async (slug: string) => {
    try {
      const res = await api.get(`/pages/${slug}`);
      setActive(res.data);
      setForm({
        title: res.data.title,
        subtitle: res.data.subtitle || '',
        content: res.data.content,
      });
      setDirty(false);
      setMode('edit');
    } catch {
      await showAlert({ title: 'Error', message: 'Failed to open page', variant: 'error' });
    }
  };

  const handleSelect = async (slug: string) => {
    if (dirty) {
      await showAlert({
        title: 'Unsaved changes',
        message: 'Save or discard your changes before switching pages.',
        variant: 'warning',
      });
      return;
    }
    await openPage(slug);
  };

  const handleSave = async () => {
    if (!active) return;
    if (!form.title.trim() || !form.content.trim()) {
      await showAlert({ title: 'Validation', message: 'Title and content cannot be empty', variant: 'warning' });
      return;
    }
    try {
      setSaving(true);
      await api.patch(`/pages/${active.slug}`, {
        title: form.title,
        subtitle: form.subtitle,
        content: form.content,
      });
      setDirty(false);
      await fetchPages();
      await showAlert({ title: 'Saved', message: `"${form.title}" has been updated`, variant: 'success' });
    } catch (e: any) {
      await showAlert({
        title: 'Error',
        message: e.response?.data?.message || 'Failed to save page',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { void fetchPages(); }, []);

  const update = (patch: Partial<typeof form>) => {
    setForm(prev => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const todoCount = countTodos(form.content);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Content Pages</h1>
        <p className="text-text-secondary text-sm mt-1">
          Edit the copy shown on the public site's footer pages
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Page list */}
        <div className="lg:col-span-1 space-y-2">
          {loading ? (
            <div className="card-widget p-4 text-text-secondary text-sm">Loading…</div>
          ) : (
            pages.map(p => {
              const isActive = active?.slug === p.slug;
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelect(p.slug)}
                  className={`w-full text-left card-widget p-3.5 transition border-l-2 ${
                    isActive
                      ? 'border-l-coral bg-coral-light/40'
                      : 'border-l-transparent hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FileText size={15} className={isActive ? 'text-coral' : 'text-text-tertiary'} />
                    <span className={`text-sm font-semibold ${isActive ? 'text-coral' : 'text-text-primary'}`}>
                      {p.title}
                    </span>
                  </div>
                  <p className="text-xs text-text-tertiary mt-1 ml-[23px]">/{p.slug}</p>
                </button>
              );
            })
          )}
        </div>

        {/* Editor */}
        <div className="lg:col-span-3">
          {!active ? (
            <div className="card-widget p-12 text-center text-text-secondary">
              Select a page to edit
            </div>
          ) : (
            <div className="card-widget p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1 bg-muted p-1">
                  <button
                    onClick={() => setMode('edit')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition ${
                      mode === 'edit' ? 'bg-surface text-coral shadow-sm' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    onClick={() => setMode('preview')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition ${
                      mode === 'preview' ? 'bg-surface text-coral shadow-sm' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Eye size={14} /> Preview
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {dirty && <span className="text-xs font-semibold text-warning">Unsaved changes</span>}
                  <button
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className="btn-primary flex items-center gap-2 px-5 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Save size={15} /> {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>

              {todoCount > 0 && (
                <div className="flex items-start gap-2.5 bg-warning-light border border-warning/20 p-3">
                  <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
                  <p className="text-xs text-warning leading-relaxed">
                    <span className="font-bold">{todoCount} placeholder{todoCount !== 1 ? 's' : ''} still to complete.</span>{' '}
                    Search the content for <code className="font-mono">[TODO:</code> — each marks a detail only you can
                    supply. Visitors can see this page, so replace them before launch.
                  </p>
                </div>
              )}

              {mode === 'edit' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-1.5">Page Title</label>
                      <input
                        value={form.title}
                        onChange={e => update({ title: e.target.value })}
                        className="filter-select w-full bg-surface"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-text-primary mb-1.5">
                        Subtitle <span className="font-normal text-text-tertiary">(optional)</span>
                      </label>
                      <input
                        value={form.subtitle}
                        onChange={e => update({ subtitle: e.target.value })}
                        className="filter-select w-full bg-surface"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <label className="block text-sm font-semibold text-text-primary">Content</label>
                      <span className="text-xs text-text-tertiary">
                        <code className="font-mono">## Heading</code> ·{' '}
                        <code className="font-mono">### Subheading</code> ·{' '}
                        <code className="font-mono">- bullet</code> ·{' '}
                        <code className="font-mono">**bold**</code> · blank line = new paragraph
                      </span>
                    </div>
                    <textarea
                      value={form.content}
                      onChange={e => update({ content: e.target.value })}
                      spellCheck
                      className="filter-select w-full bg-surface font-mono text-[13px] leading-relaxed"
                      style={{ minHeight: '30rem', resize: 'vertical' }}
                    />
                  </div>
                </>
              ) : (
                <div className="border border-border bg-surface p-6 max-h-[42rem] overflow-y-auto">
                  <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">{form.title}</h1>
                  {form.subtitle && (
                    <p className="text-sm text-text-secondary mt-1.5">{form.subtitle}</p>
                  )}
                  <div className="mt-6 pt-5 border-t border-border text-sm">
                    {renderPreview(form.content)}
                  </div>
                </div>
              )}

              <p className="text-xs text-text-tertiary">
                Live at <code className="font-mono">/{active.slug}</code> · last updated{' '}
                {new Date(active.updatedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContentPages;
