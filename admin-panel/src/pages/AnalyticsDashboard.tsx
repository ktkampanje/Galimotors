import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, RefreshCw, Car, Zap, ChevronRight,
  Banknote, ShieldCheck, HandCoins, Clock, MessageSquare
} from 'lucide-react';
import { api } from '../lib/api';
import { leadTypeLabel, INQUIRY_LEAD_TYPES } from '../lib/leadTypes';
import ResizableSplit from '../components/ResizableSplit';

/**
 * Overview — the morning screen. Rules: every number is true under the
 * system's own lifecycles, every card navigates somewhere useful, and
 * nothing decorative pretends to be data (the old fake "Growing" trend,
 * always-zero Revenue and made-up funnel conversions are gone).
 */

interface DashboardData {
  inventory: {
    available: number; total: number; soldAllTime: number; soldThisMonth: number;
    recent: { id: string; title: string; basePrice: number; status: string }[];
  };
  leads: {
    openInquiries: number; newInquiries: number; openViewings: number;
    openByStatus: { status: string; count: number }[];
    recent: { id: string; buyerName: string; buyerPhone: string; type: string; status: string; createdAt: string; car?: { title: string } | null }[];
  };
  actionQueues: {
    pendingPayments: number;
    pendingApprovalCars: number;
    pendingSoldRequests?: number;
    newSellRequests: number;
    systemErrors: number;
    expiringReservations: { id: string; title: string; reservationExpiry: string }[];
  };
}

// Pipeline order + labels for the open-leads chart.
const STAGE_ORDER: { status: string; label: string }[] = [
  { status: 'NEW', label: 'New — no reply yet' },
  { status: 'IN_PROGRESS', label: 'In progress' },
  { status: 'QUOTE_SENT', label: 'Quote sent' },
  { status: 'NEGOTIATION', label: 'Negotiating' },
  { status: 'QUOTE_ACCEPTED', label: 'Quote accepted' },
  { status: 'VIEWING_SCHEDULED', label: 'Viewing scheduled' },
];

const timeAgo = (iso: string): string => {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
};

export default function AnalyticsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (!loading) setTimeout(() => setMounted(true), 50); }, [loading]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/dashboard');
      setData(res.data);
    } catch (e) {
      console.error('Failed to fetch', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex items-center gap-3 text-text-tertiary animate-fade-up">
          <div className="w-5 h-5 border-2 border-coral/30 border-t-coral rounded-full animate-spin" />
          <span className="text-sm">Loading overview...</span>
        </div>
      </div>
    );
  }

  const inv = data?.inventory;
  const leads = data?.leads;
  const queues = data?.actionQueues;

  // ── Action items: real queues only, each with a real destination ──
  const actions: { label: string; detail: string; urgent: boolean; to: string; icon: React.ReactNode }[] = [];
  if (queues?.systemErrors) {
    actions.push({
      label: `${queues.systemErrors} system error${queues.systemErrors > 1 ? 's' : ''} recorded`,
      detail: 'Something failed on the server — review it', urgent: true, to: '/system-errors', icon: <ShieldCheck size={15} />,
    });
  }
  if (queues?.pendingPayments) {
    actions.push({
      label: `${queues.pendingPayments} payment${queues.pendingPayments > 1 ? 's' : ''} awaiting verification`,
      detail: 'Customers are waiting on you to confirm', urgent: true, to: '/payments', icon: <Banknote size={15} />,
    });
  }
  queues?.expiringReservations.forEach(r => {
    const hrs = Math.max(0, Math.floor((new Date(r.reservationExpiry).getTime() - Date.now()) / 3600000));
    actions.push({
      label: `Reservation expiring: ${r.title}`,
      detail: `${hrs}h remaining`, urgent: hrs < 24, to: '/viewings', icon: <Clock size={15} />,
    });
  });
  if (leads?.newInquiries) {
    actions.push({
      label: `${leads.newInquiries} inquir${leads.newInquiries > 1 ? 'ies' : 'y'} with no reply yet`,
      detail: 'First response wins the customer', urgent: true, to: '/leads', icon: <MessageSquare size={15} />,
    });
  }
  if (queues?.pendingApprovalCars) {
    actions.push({
      label: `${queues.pendingApprovalCars} car${queues.pendingApprovalCars > 1 ? 's' : ''} awaiting approval`,
      detail: 'Submitted by sellers or attendants', urgent: false, to: '/pending-approval', icon: <ShieldCheck size={15} />,
    });
  }
  if (queues?.pendingSoldRequests) {
    actions.push({
      label: `${queues.pendingSoldRequests} sold request${queues.pendingSoldRequests > 1 ? 's' : ''} to confirm`,
      detail: 'Sellers say these cars are sold — confirm to delist', urgent: true, to: '/pending-approval', icon: <ShieldCheck size={15} />,
    });
  }
  if (queues?.newSellRequests) {
    actions.push({
      label: `${queues.newSellRequests} new sell request${queues.newSellRequests > 1 ? 's' : ''}`,
      detail: 'Owners want us to sell their car', urgent: false, to: '/sell-requests', icon: <HandCoins size={15} />,
    });
  }

  const metrics = [
    { label: 'Cars for sale', value: inv?.available ?? 0, sub: `${inv?.total ?? 0} in system`, to: '/inventory', highlight: false },
    { label: 'Open inquiries', value: leads?.openInquiries ?? 0, sub: leads?.newInquiries ? `${leads.newInquiries} awaiting first reply` : 'All have been answered', to: '/leads', highlight: !!leads?.newInquiries },
    { label: 'Viewings & reservations', value: leads?.openViewings ?? 0, sub: 'Paid, in progress', to: '/viewings', highlight: false },
    { label: 'Cars sold', value: inv?.soldAllTime ?? 0, sub: `${inv?.soldThisMonth ?? 0} this month`, to: '/inventory', highlight: false },
  ];

  const stages = STAGE_ORDER.map(s => ({
    ...s,
    count: leads?.openByStatus.find(r => r.status === s.status)?.count ?? 0,
  }));
  const maxStage = Math.max(...stages.map(s => s.count), 1);
  const totalOpen = stages.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${mounted ? 'animate-fade-up' : 'opacity-0'}`}>
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Overview</h1>
          <p className="text-sm text-text-tertiary mt-0.5">Your brokerage at a glance — every number is live.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="btn-secondary flex items-center gap-1.5">
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => navigate('/inventory')}
            className="flex items-center gap-1.5 px-4 py-2 bg-gold text-dark text-sm font-semibold rounded-lg hover:bg-gold/90 hover:shadow-md hover:shadow-gold/30 active:scale-[0.98] transition-all duration-200"
          >
            <Plus size={14} />
            Add listing
          </button>
        </div>
      </div>

      {/* Metrics row — the brand band: deep navy, gold where it matters.
          Each tile opens its screen. */}
      <div className={`relative grid grid-cols-2 lg:grid-cols-4 gap-px bg-coral-dark rounded-xl overflow-hidden border border-coral-dark shadow-lg shadow-coral/10 ${mounted ? 'animate-fade-up delay-1' : 'opacity-0'}`}>
        {/* soft gold glow, top-right — same treatment as the dealership hero */}
        <div className="absolute top-0 right-0 w-56 h-56 bg-gold/10 rounded-full blur-[70px] -translate-y-1/2 translate-x-1/4 pointer-events-none z-10" />
        {metrics.map((m, i) => (
          <button
            key={i}
            onClick={() => navigate(m.to)}
            className="relative z-10 bg-coral p-5 flex flex-col justify-between min-h-[120px] text-left group hover:bg-coral-dark transition-colors duration-300"
          >
            <span className="text-[13px] text-white/60 flex items-center justify-between w-full">
              {m.label}
              <ChevronRight size={13} className="text-gold opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
            <div className="mt-3">
              <span className={`text-2xl font-semibold tracking-tight block text-white ${mounted ? 'animate-count-up' : 'opacity-0'}`} style={{ animationDelay: `${200 + i * 100}ms` }}>
                {m.value}
              </span>
              <span className={`text-xs mt-1 block ${m.highlight ? 'text-gold font-semibold' : 'text-white/40'}`}>
                {m.sub}
              </span>
            </div>
            {/* gold baseline that draws on hover */}
            <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-gold group-hover:w-full transition-all duration-300" />
          </button>
        ))}
      </div>

      {/* Main content row — draggable divider, width remembered per device */}
      <ResizableSplit
        storageKey="overviewPipeline"
        className={`gap-6 lg:gap-0 ${mounted ? 'animate-fade-up delay-3' : 'opacity-0'}`}
        defaultRightWidth={420}
        minRightWidth={340}
        maxRightWidth={640}
        left={

        <div className="flex-1 bg-surface border border-border rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-medium text-text-primary flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
              Open leads by stage
            </h2>
            <span className="text-xs text-text-tertiary">{totalOpen} lead{totalOpen !== 1 ? 's' : ''} being worked</span>
          </div>

          <div className="p-5">
            {totalOpen > 0 ? (
              <div className="space-y-3">
                {stages.map((s, i) => (
                  <button
                    key={s.status}
                    onClick={() => navigate(s.status === 'VIEWING_SCHEDULED' ? '/viewings' : '/leads')}
                    className="w-full flex items-center gap-3 group"
                  >
                    <span className="w-36 shrink-0 text-left text-xs text-text-secondary group-hover:text-text-primary transition-colors leading-tight">
                      {s.label}
                    </span>
                    <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden relative">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-md transition-all duration-700 ease-out ${s.status === 'NEW' ? 'bg-gold' : 'bg-coral/85 group-hover:bg-coral'}`}
                        style={{
                          width: mounted ? `${Math.max((s.count / maxStage) * 100, s.count > 0 ? 6 : 0)}%` : '0%',
                          transitionDelay: `${300 + i * 80}ms`,
                        }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-sm font-semibold text-text-primary">{s.count}</span>
                  </button>
                ))}
                <p className="text-[11px] text-text-tertiary pt-2">
                  Leads still being worked, across inquiries and viewings. Click a stage to open it.
                </p>
              </div>
            ) : (
              <div className="py-12 text-center text-text-tertiary">
                <MessageSquare size={20} className="mx-auto mb-2 text-coral/40" />
                <p className="text-sm">No open leads right now.</p>
              </div>
            )}
          </div>
        </div>

        }
        right={

        <div className="flex-1 bg-surface border border-border rounded-xl flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-medium text-text-primary flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
              Needs your attention
            </h2>
            {actions.length > 0 && (
              <span className="text-[11px] font-semibold text-gold-dark bg-gold-light px-2 py-0.5 rounded-full border border-gold/30">{actions.length}</span>
            )}
          </div>

          <div className="flex-1 divide-y divide-border">
            {actions.length > 0 ? actions.slice(0, 6).map((a, i) => (
              <button
                key={i}
                onClick={() => navigate(a.to)}
                className="w-full px-5 py-3.5 flex items-start gap-3 text-left hover:bg-muted/40 transition-all duration-200 group"
              >
                <span className={`mt-0.5 shrink-0 ${a.urgent ? 'text-gold-dark' : 'text-text-tertiary'}`}>{a.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-text-primary font-medium leading-snug group-hover:text-coral transition-colors duration-200">{a.label}</p>
                  <p className="text-xs text-text-tertiary mt-0.5">{a.detail}</p>
                </div>
                <ChevronRight size={14} className="text-text-tertiary opacity-0 group-hover:opacity-100 transition-all duration-200 mt-0.5 shrink-0" />
              </button>
            )) : (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-text-tertiary">
                <Zap size={20} className="mb-2 text-gold/60" />
                <span className="text-sm">All clear — nothing needs attention.</span>
              </div>
            )}
          </div>
        </div>

        }
      />

      {/* Bottom row — same adjustable split */}
      <ResizableSplit
        storageKey="overviewRecent"
        className={`gap-6 lg:gap-0 ${mounted ? 'animate-fade-up delay-5' : 'opacity-0'}`}
        defaultRightWidth={420}
        minRightWidth={340}
        maxRightWidth={640}
        left={

        <div className="flex-1 bg-surface border border-border rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-medium text-text-primary flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
              Recent listings
            </h2>
            <button
              onClick={() => navigate('/inventory')}
              className="text-xs text-text-secondary hover:text-coral font-medium transition-colors duration-200"
            >
              View all
            </button>
          </div>

          <div className="divide-y divide-border">
            {inv?.recent.map((car, i) => (
              <button
                key={car.id}
                onClick={() => navigate(`/inventory?search=${car.id.slice(0, 8)}`)}
                className="w-full px-5 py-3 flex items-center gap-4 text-left hover:bg-muted/40 transition-all duration-200 group"
                style={mounted ? { animation: `fadeUp 0.3s ease-out ${500 + i * 60}ms both` } : { opacity: 0 }}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200 ${
                  car.status === 'AVAILABLE' ? 'bg-coral-light text-coral group-hover:bg-coral group-hover:text-white' : 'bg-muted text-text-tertiary'
                }`}>
                  <Car size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-text-primary truncate">{car.title}</p>
                  <p className="text-xs text-text-tertiary">MK {car.basePrice.toLocaleString()}</p>
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md transition-colors duration-200 ${
                  car.status === 'AVAILABLE'
                    ? 'bg-gold-light text-gold-dark border border-gold/25'
                    : car.status === 'SOLD'
                      ? 'bg-muted text-text-tertiary'
                      : 'bg-amber-50 text-amber-700'
                }`}>
                  {car.status.charAt(0) + car.status.slice(1).toLowerCase().replace(/_/g, ' ')}
                </span>
              </button>
            ))}
            {(!inv?.recent || inv.recent.length === 0) && (
              <div className="px-5 py-10 text-center text-sm text-text-tertiary">No listings yet.</div>
            )}
          </div>
        </div>

        }
        right={
        /* Latest leads — replaces the fake Revenue card with the thing the
           business actually runs on */
        <div className="flex-1 bg-surface border border-border rounded-xl flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-medium text-text-primary flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
              Latest leads
            </h2>
            <button
              onClick={() => navigate('/leads')}
              className="text-xs text-text-secondary hover:text-coral font-medium transition-colors duration-200"
            >
              View all
            </button>
          </div>

          <div className="flex-1 divide-y divide-border">
            {leads?.recent && leads.recent.length > 0 ? leads.recent.map(lead => {
              const isInquiry = (INQUIRY_LEAD_TYPES as readonly string[]).includes(lead.type);
              const target = isInquiry ? '/leads' : '/viewings';
              return (
                <button
                  key={lead.id}
                  onClick={() => navigate(`${target}?search=${encodeURIComponent(lead.buyerPhone || lead.buyerName)}`)}
                  className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-muted/40 transition-all duration-200 group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-text-primary truncate group-hover:text-coral transition-colors duration-200">
                      {lead.buyerName}
                    </p>
                    <p className="text-xs text-text-tertiary truncate mt-0.5">{lead.car?.title || 'General'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {/* Paid lead types carry money — they get the gold chip. */}
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md block ${
                      isInquiry ? 'bg-muted text-text-secondary' : 'bg-gold-light text-gold-dark border border-gold/25'
                    }`}>
                      {leadTypeLabel(lead.type)}
                    </span>
                    <span className="text-[11px] text-text-tertiary mt-1 block">{timeAgo(lead.createdAt)}</span>
                  </div>
                </button>
              );
            }) : (
              <div className="px-5 py-10 text-center text-sm text-text-tertiary">No leads yet.</div>
            )}
          </div>
        </div>

        }
      />
    </div>
  );
}
