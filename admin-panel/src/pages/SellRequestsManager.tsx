import React, { useState, useEffect } from 'react';
import { HandCoins, PhoneCall, MessageCircle, MapPin, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useModal } from '../components/ui/ModalContext';
import CustomSelect from '../components/ui/CustomSelect';
import { buildWhatsAppUrl, phoneMatchesQuery } from '../lib/whatsapp';

interface SellRequest {
  id: string;
  name: string;
  phone: string;
  district?: string | null;
  carDetails: string;
  expectedPrice?: number | null;
  status: string;
  createdAt: string;
}

const STATUS_TONE: Record<string, string> = {
  NEW: 'bg-warning-light text-warning',
  CONTACTED: 'bg-info-light text-info',
  LISTED: 'bg-success-light text-success',
  DECLINED: 'bg-danger-light text-danger',
};

/**
 * Owners asking GaliMotors to sell their car (the public /sell page).
 * Workflow: call or WhatsApp the owner, inspect, then either create the Car
 * in Inventory (mark LISTED) or decline. Nothing notifies automatically.
 */
const SellRequestsManager: React.FC = () => {
  const { showAlert } = useModal();
  const [requests, setRequests] = useState<SellRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await api.get('/sell-requests');
      setRequests(res.data || []);
    } catch {
      await showAlert({ title: 'Error', message: 'Failed to load sell requests', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  useEffect(() => {
    const s = searchParams.get('search');
    if (s) {
      setQuery(s);
      setStatusFilter('ALL');
    }
  }, [searchParams]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/sell-requests/${id}/status`, { status });
      setRequests(prev => prev.map(r => (r.id === id ? { ...r, status } : r)));
    } catch {
      await showAlert({ title: 'Error', message: 'Failed to update status', variant: 'error' });
    }
  };

  const filtered = requests.filter(r => {
    const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const q = query.toLowerCase();
    const matchesQuery = !q ||
      r.name.toLowerCase().includes(q) ||
      r.carDetails.toLowerCase().includes(q) ||
      (r.district || '').toLowerCase().includes(q) ||
      phoneMatchesQuery(r.phone, query) ||
      r.id.includes(query);
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Sell Requests</h1>
        <p className="text-text-secondary text-sm mt-1">
          Owners who want GaliMotors to sell their car. Contact them, inspect,
          then add the car in Inventory and mark the request Listed.
        </p>
      </div>

      <div className="card-widget p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search name, phone, district or car…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="filter-select w-full pl-9"
          />
        </div>
        <div className="w-full sm:w-48">
          <CustomSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { id: 'ALL', name: 'All statuses' },
              { id: 'NEW', name: 'New' },
              { id: 'CONTACTED', name: 'Contacted' },
              { id: 'LISTED', name: 'Listed' },
              { id: 'DECLINED', name: 'Declined' },
            ]}
            placeholder="Status"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-secondary">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card-widget p-12 text-center">
          <HandCoins size={32} className="mx-auto text-text-tertiary mb-3" />
          <p className="text-text-secondary font-medium">
            {requests.length === 0
              ? 'No sell requests yet. They arrive from the "Sell Your Car" page on the website.'
              : 'Nothing matches your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const waHref = buildWhatsAppUrl(
              r.phone,
              `Hi ${r.name.split(' ')[0]}, this is GaliMotors. We received your request to sell your car (${r.carDetails.slice(0, 120)}…). When can we arrange an inspection?`
            );
            return (
              <div key={r.id} className="card-widget p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[15px] font-bold text-text-primary">{r.name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${STATUS_TONE[r.status] || 'bg-muted text-text-secondary'}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5 tabular-nums">
                      {r.phone}
                      {r.district && (
                        <span className="inline-flex items-center gap-1 ml-3">
                          <MapPin size={11} /> {r.district}
                        </span>
                      )}
                      <span className="ml-3 text-text-tertiary">
                        {new Date(r.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </p>
                  </div>
                  <div className="w-40 shrink-0">
                    <CustomSelect
                      value={r.status}
                      onChange={val => updateStatus(r.id, val)}
                      options={[
                        { id: 'NEW', name: 'New' },
                        { id: 'CONTACTED', name: 'Contacted' },
                        { id: 'LISTED', name: 'Listed' },
                        { id: 'DECLINED', name: 'Declined' },
                      ]}
                      placeholder="Status"
                    />
                  </div>
                </div>

                <p className="text-sm text-text-primary bg-muted/60 border border-border p-3 mt-3 whitespace-pre-wrap leading-relaxed">
                  {r.carDetails}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                  <p className="text-sm">
                    <span className="text-text-tertiary">Owner wants: </span>
                    <span className="font-bold text-text-primary">
                      {r.expectedPrice ? `MK ${r.expectedPrice.toLocaleString()}` : 'Not stated'}
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <a
                      href={`tel:${r.phone}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-border text-xs font-bold text-text-primary hover:bg-muted transition-colors rounded-lg"
                    >
                      <PhoneCall size={13} /> Call
                    </a>
                    {waHref && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#25D366] hover:bg-[#1fb85a] text-white text-xs font-bold transition-colors rounded-lg"
                      >
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SellRequestsManager;
