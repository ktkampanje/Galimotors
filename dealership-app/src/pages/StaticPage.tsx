import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';

interface StaticPageData {
  slug: string;
  title: string;
  subtitle?: string | null;
  content: string;
  updatedAt: string;
}

/**
 * Renders the markdown-lite content authored in the admin panel.
 *
 * Deliberately parsed to React elements rather than injected as HTML — the
 * copy is admin-authored, but rendering it as raw HTML would turn the page
 * editor into a stored-XSS vector the moment an account is compromised.
 *
 * Supported syntax:
 *   ## Heading      -> h2
 *   ### Subheading  -> h3
 *   - item          -> bullet list
 *   _text_          -> emphasis (whole line only)
 *   **bold**        -> inline bold
 *   blank line      -> paragraph break
 */

// Splits a line on **bold** runs. Anything unmatched renders as plain text.
const renderInline = (text: string): React.ReactNode => {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} className="font-bold text-dark">{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

const renderContent = (content: string): React.ReactNode[] => {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let paraBuffer: string[] = [];

  const flushList = () => {
    if (!listBuffer.length) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="list-disc pl-5 space-y-1.5 mb-5 text-text-secondary">
        {listBuffer.map((item, i) => (
          <li key={i} className="leading-relaxed">{renderInline(item)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  const flushPara = () => {
    if (!paraBuffer.length) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-text-secondary leading-relaxed mb-4">
        {renderInline(paraBuffer.join(' '))}
      </p>
    );
    paraBuffer = [];
  };

  const flushAll = () => { flushList(); flushPara(); };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) { flushAll(); continue; }

    if (line.startsWith('### ')) {
      flushAll();
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="text-[15px] sm:text-[16px] font-bold text-dark mt-7 mb-2.5">
          {line.slice(4)}
        </h3>
      );
      continue;
    }

    if (line.startsWith('## ')) {
      flushAll();
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className="text-[18px] sm:text-[20px] font-extrabold text-dark tracking-tight mt-10 mb-3 pb-2 border-b border-border first:mt-0">
          {line.slice(3)}
        </h2>
      );
      continue;
    }

    if (line.startsWith('- ')) {
      flushPara();
      listBuffer.push(line.slice(2));
      continue;
    }

    // A whole line wrapped in underscores renders as muted emphasis, used for
    // the "Last updated" line on policy pages.
    if (line.startsWith('_') && line.endsWith('_') && line.length > 2) {
      flushAll();
      blocks.push(
        <p key={`em-${blocks.length}`} className="text-[12.5px] italic text-text-tertiary mb-5">
          {line.slice(1, -1)}
        </p>
      );
      continue;
    }

    flushList();
    paraBuffer.push(line);
  }

  flushAll();
  return blocks;
};

const StaticPage: React.FC<{ slug?: string }> = ({ slug: slugProp }) => {
  const params = useParams();
  const slug = slugProp || params.slug || '';

  const [page, setPage] = useState<StaticPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    api.get(`/pages/${slug}`)
      .then(r => { if (!cancelled) setPage(r.data); })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="page-container py-10 max-w-3xl">
        <div className="h-7 w-56 bg-muted skeleton mb-3" />
        <div className="h-4 w-80 bg-muted skeleton mb-10" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="mb-6">
            <div className="h-4 w-40 bg-muted skeleton mb-3" />
            <div className="h-3 w-full bg-muted skeleton mb-2" />
            <div className="h-3 w-11/12 bg-muted skeleton" />
          </div>
        ))}
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="page-container py-20 max-w-3xl text-center">
        <h1 className="text-[22px] font-extrabold text-dark mb-2">Page not found</h1>
        <p className="text-text-secondary text-[14px] mb-6">
          This page may have been moved or is not yet published.
        </p>
        <Link to="/" className="btn-outline text-[13px]">Back to home</Link>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{page.title} | GaliMotors</title>
        {page.subtitle && <meta name="description" content={page.subtitle} />}
      </Helmet>

      <div className="page-container py-8 sm:py-10 max-w-3xl">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-secondary hover:text-dark transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Back to home
        </Link>

        <header className="mb-8 pb-6 border-b border-border">
          <h1 className="text-[24px] sm:text-[28px] font-extrabold text-dark tracking-tight leading-tight">
            {page.title}
          </h1>
          {page.subtitle && (
            <p className="text-[14px] text-text-secondary mt-2 leading-relaxed">{page.subtitle}</p>
          )}
        </header>

        <article className="text-[14px]">
          {renderContent(page.content)}
        </article>
      </div>
    </>
  );
};

export default StaticPage;
