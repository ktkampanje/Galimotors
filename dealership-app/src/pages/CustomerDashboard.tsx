import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User, Heart, History, MessageSquare, Settings,
  ChevronRight, LogOut, Clock, ExternalLink, MapPin, Eye
} from 'lucide-react';
import { api } from '../lib/api';
import customerAuthService from '../lib/customerAuthService';
import favoritesService from '../lib/favoritesService';
import recentlyViewedService from '../lib/recentlyViewedService';
import { generateCarUrl } from '../lib/seoRoutes';
import { getCloudinaryThumbnail, getPrimaryImage, handleImageError } from '../lib/imageHelper';

interface Inquiry {
  id: string;
  carId: string;
  status: string;
  createdAt: string;
  car: {
    id: string;
    title: string;
    basePrice: number;
    images: { url: string; isPrimary?: boolean }[];
    maker?: { name: string };
    model?: { name: string };
  };
  referenceNumber?: string;
  type?: string;
  paymentStatus?: string;
  paymentAmount?: number;
  calculatedTotalCost?: number;
}

const CustomerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [viewings, setViewings] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'favorites' | 'history' | 'inquiries' | 'viewings'>('overview');

  useEffect(() => {
    if (!customerAuthService.isAuthenticated()) {
      navigate('/', { replace: true });
      return;
    }
    // Show the cached identity immediately, but confirm the session against
    // the server; if the token is stale/revoked, bounce home.
    setCustomer(customerAuthService.getCustomer());
    (async () => {
      const verified = await customerAuthService.verifySession();
      if (!verified) {
        navigate('/', { replace: true });
        return;
      }
      setCustomer(verified);
      fetchDashboardData();
    })();
  }, [navigate]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [favs, history, inqRes] = await Promise.all([
        favoritesService.getFavorites(),
        recentlyViewedService.getRecentlyViewed(),
        api.get('/leads/my-inquiries').catch(() => ({ data: [] }))
      ]);
      setFavorites((favs || []).map((item: any) => item.car || item));
      setRecentlyViewed(history || []);
      const allLeads = inqRes.data || [];
      setInquiries(allLeads.filter((l: any) => l.type !== 'PAID_VIEWING_REQUEST'));
      setViewings(allLeads.filter((l: any) => l.type === 'PAID_VIEWING_REQUEST'));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    customerAuthService.logout();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-coral/20 border-t-coral animate-spin"></div>
          <p className="text-sm font-semibold text-gray-500">Preparing your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 animate-fade-in">
      {/* Header / Profile Summary */}
      <div className="bg-dark text-white pt-10 pb-20 px-4 lg:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gold flex items-center justify-center text-2xl font-extrabold text-dark">
              {customer?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold tracking-tight">{customer?.name}</h1>
              <p className="text-white/60 text-[13px] font-medium">{customer?.email}</p>
              <div className="flex gap-2 mt-2.5">
                <span className="text-[10px] bg-white/10 px-2.5 py-1 text-white font-bold tracking-wide uppercase">Verified Member</span>
                <span className="text-[10px] px-2.5 py-1 text-gold font-bold tracking-wide uppercase border border-gold/30">Malawi Brokerage</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-[13px] font-bold transition-colors border border-white/10 flex items-center gap-2"
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 lg:px-6 -mt-10 relative z-10">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Sidebar Navigation */}
          <aside className="w-full lg:w-64 shrink-0">
            <div className="bg-white border border-border p-2 space-y-0.5">
              {[
                { id: 'overview', icon: User, label: 'Overview' },
                { id: 'favorites', icon: Heart, label: 'My Favorites', count: favorites.length },
                { id: 'inquiries', icon: MessageSquare, label: 'My Inquiries', count: inquiries.length },
                { id: 'viewings', icon: Eye, label: 'My Viewings', count: viewings.length },
                { id: 'history', icon: History, label: 'History' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-[13px] font-bold transition-colors ${
                    activeTab === tab.id
                      ? 'bg-coral text-white'
                      : 'text-text-secondary hover:bg-muted hover:text-dark'
                  }`}
                >
                  <tab.icon size={16} /> {tab.label}
                  {tab.count !== undefined && (
                    <span className={`ml-auto text-[10px] px-2 py-0.5 ${
                      activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-muted text-text-tertiary'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
              <div className="pt-2 mt-2 border-t border-border/60">
                <button className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-bold text-text-secondary hover:bg-muted transition-colors">
                  <Settings size={16} /> Profile Settings
                </button>
              </div>
            </div>
          </aside>

          {/* Tab Content */}
          <main className="flex-1 min-w-0">
            {activeTab === 'overview' && (
              <div className="space-y-6 stagger-children">
                {/* Stats Grid */}
                <div className="grid grid-cols-3 border border-border divide-x divide-border">
                  {[
                    { icon: Heart, value: favorites.length, label: 'Favorited Cars' },
                    { icon: MessageSquare, value: inquiries.length, label: 'Active Inquiries' },
                    { icon: History, value: recentlyViewed.length, label: 'Recently Viewed' },
                  ].map(({ icon: Icon, value, label }) => (
                    <div key={label} className="p-5 sm:p-6">
                      <div className="flex items-center gap-2 text-text-tertiary mb-3">
                        <Icon size={15} className="text-gold-dark" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
                      </div>
                      <div className="text-3xl font-extrabold text-dark tracking-tight">{value}</div>
                    </div>
                  ))}
                </div>

                {/* Recent Inquiries Section */}
                <div className="bg-white border border-border overflow-hidden">
                  <div className="px-6 py-4 border-b border-border/60 flex justify-between items-center bg-gray-50/30">
                    <h2 className="text-[11px] font-extrabold text-dark uppercase tracking-widest">Inquiry Pipeline</h2>
                    <button onClick={() => setActiveTab('inquiries')} className="text-[11px] font-bold text-gold-dark flex items-center gap-1 hover:text-dark transition-colors">
                      See All <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="divide-y divide-border/60">
                    {inquiries.slice(0, 3).map((inq) => (
                      <div key={inq.id} className="p-5 flex items-center gap-5 group hover:bg-muted/50 transition-colors">
                        <div className="w-20 h-14 bg-muted overflow-hidden shrink-0">
                          <img src={getCloudinaryThumbnail(getPrimaryImage(inq.car.images)?.url, 160)} className="w-full h-full object-cover" alt="" onError={handleImageError} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-[13px] font-bold text-dark truncate mb-1 group-hover:text-gold-dark transition-colors">{inq.car.title}</h3>
                          <div className="flex gap-4">
                            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1">
                              <Clock size={11} /> {new Date(inq.createdAt).toLocaleDateString()}
                            </span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 uppercase tracking-wider ${
                              inq.status === 'NEW' ? 'bg-info-light text-info border border-info/20' :
                              inq.status === 'CONTACTED' ? 'bg-warning-light text-warning border border-warning/20' :
                              'bg-success-light text-success border border-success/20'
                            }`}>
                              {inq.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Link to={generateCarUrl(inq.car as any)} className="text-text-tertiary hover:text-dark flex items-center gap-1 text-[10px] font-bold bg-muted px-2.5 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">
                             Car <ExternalLink size={10} />
                           </Link>
                           <Link to={`/quote/${inq.referenceNumber}`} className="text-gold-dark flex items-center gap-1 text-[11px] font-bold bg-gold-light px-3 py-1.5 rounded-lg hover:bg-coral hover:text-white transition-colors">
                             Quote Trail <ExternalLink size={12} />
                           </Link>
                        </div>
                      </div>
                    ))}
                    {inquiries.length === 0 && (
                      <div className="p-10 text-center flex flex-col items-center">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-3">
                          <MessageSquare size={20} className="text-text-tertiary opacity-50" />
                        </div>
                        <p className="text-[13px] font-semibold text-text-secondary">No active inquiries</p>
                        <p className="text-[11px] text-text-tertiary mt-1">Find your dream car and contact a seller!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'favorites' && (
              <div className="animate-fade-up">
                <div className="mb-6 flex justify-between items-end">
                  <h2 className="text-[20px] font-extrabold text-dark tracking-tight">Saved Vehicles</h2>
                  <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-widest">{favorites.length} Results</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 stagger-children">
                  {favorites.map((car) => (
                    <Link
                      key={car.id}
                      to={generateCarUrl(car)}
                      className="car-item no-underline text-inherit group"
                    >
                      <div className="car-item-image aspect-[16/10]">
                        <img
                          src={getCloudinaryThumbnail(getPrimaryImage(car.images)?.url, 500)}
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                          alt={car.title}
                          onError={handleImageError}
                        />
                        {car.year && (
                          <span className="absolute bottom-2 left-2 bg-white/95 text-dark text-[11px] font-bold px-2.5 py-1 shadow-sm z-10">
                            {car.year}
                          </span>
                        )}
                      </div>
                      <div className="px-1 mt-2.5 space-y-1.5">
                        <h3 className="car-item-title group-hover:text-gold-dark transition-colors truncate">{car.title}</h3>
                        
                        <div className="flex items-baseline gap-2">
                          <span className="car-item-price">MK {Number(car.basePrice).toLocaleString()}</span>
                        </div>

                        {car.district && (
                          <div className="flex items-center gap-1.5">
                            <MapPin size={11} className="text-text-tertiary shrink-0" />
                            <span className="text-[11.5px] font-medium text-text-secondary">{car.district}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
                {favorites.length === 0 && (
                  <div className="py-20 bg-white border border-dashed border-border flex flex-col items-center gap-4">
                    <Heart size={40} className="text-text-tertiary opacity-30" />
                    <p className="text-[13px] font-bold text-text-secondary">No favorite cars yet.</p>
                    <Link to="/cars" className="btn-primary">Browse Inventory</Link>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'inquiries' && (
              <div className="bg-white border border-border overflow-hidden animate-fade-up">
                <div className="px-6 py-4 border-b border-border/60 bg-gray-50/30">
                  <h2 className="text-[11px] font-extrabold text-dark uppercase tracking-widest">Full Inquiry History</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 bg-white">
                        <th className="px-6 py-3.5 text-left text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Vehicle</th>
                        <th className="px-6 py-3.5 text-left text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Date Submitted</th>
                        <th className="px-6 py-3.5 text-left text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Status</th>
                        <th className="px-6 py-3.5 text-right text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {inquiries.map((inq) => (
                        <tr key={inq.id} className="hover:bg-muted/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-14 h-10 bg-muted overflow-hidden">
                                <img src={getCloudinaryThumbnail(getPrimaryImage(inq.car.images)?.url, 120)} className="w-full h-full object-cover" alt="" onError={handleImageError} />
                              </div>
                              <span className="text-[12px] font-bold text-dark truncate max-w-[150px] group-hover:text-gold-dark transition-colors">{inq.car.title}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[12px] font-medium text-text-secondary">{new Date(inq.createdAt).toLocaleDateString()}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-extrabold px-2.5 py-1 uppercase tracking-wider ${
                              inq.status === 'NEW' ? 'bg-info-light text-info border border-info/20' :
                              inq.status === 'CONTACTED' ? 'bg-warning-light text-warning border border-warning/20' :
                              'bg-success-light text-success border border-success/20'
                            }`}>
                              {inq.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex items-center justify-end gap-3">
                               <Link to={generateCarUrl(inq.car as any)} className="text-[11px] font-bold text-text-tertiary hover:text-dark hover:underline transition-colors">
                                 View Car
                               </Link>
                               <Link to={`/quote/${inq.referenceNumber}`} className="text-[11px] font-bold text-gold-dark hover:text-dark hover:underline transition-colors px-3 py-1.5 bg-gold-light/60 rounded-lg">
                                 Quote Trail
                               </Link>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {inquiries.length === 0 && (
                    <div className="py-16 text-center">
                      <p className="text-[12px] font-bold text-text-tertiary uppercase tracking-widest">No Inquiries Found</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'viewings' && (
              <div className="bg-white border border-border overflow-hidden animate-fade-up">
                <div className="px-6 py-4 border-b border-border/60 bg-gray-50/30">
                  <h2 className="text-[11px] font-extrabold text-dark uppercase tracking-widest">Paid Viewing Requests</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 bg-white">
                        <th className="px-6 py-3.5 text-left text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Vehicle</th>
                        <th className="px-6 py-3.5 text-left text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Date Submitted</th>
                        <th className="px-6 py-3.5 text-left text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Payment</th>
                        <th className="px-6 py-3.5 text-left text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Status</th>
                        <th className="px-6 py-3.5 text-right text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {viewings.map((viewing) => (
                        <tr key={viewing.id} className="hover:bg-muted/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-14 h-10 bg-muted overflow-hidden">
                                <img src={getCloudinaryThumbnail(getPrimaryImage(viewing.car.images)?.url, 120)} className="w-full h-full object-cover" alt="" onError={handleImageError} />
                              </div>
                              <span className="text-[12px] font-bold text-dark truncate max-w-[150px] group-hover:text-gold-dark transition-colors">{viewing.car.title}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[12px] font-medium text-text-secondary">{new Date(viewing.createdAt).toLocaleDateString()}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-extrabold px-2.5 py-1 uppercase tracking-wider ${
                              viewing.paymentStatus === 'VERIFIED' ? 'bg-success-light text-success border border-success/20' :
                              viewing.paymentStatus === 'REJECTED' ? 'bg-danger-light text-danger border border-danger/20' :
                              'bg-warning-light text-warning border border-warning/20'
                            }`}>
                              {viewing.paymentStatus?.replace(/_/g, ' ') || 'Pending'}
                            </span>
                            <div className="text-[10px] text-text-tertiary mt-1 font-semibold">MK {viewing.paymentAmount?.toLocaleString() || viewing.calculatedTotalCost?.toLocaleString()}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] font-extrabold px-2.5 py-1 uppercase tracking-wider ${
                              viewing.status === 'NEW' ? 'bg-info-light text-info border border-info/20' :
                              viewing.status === 'VIEWING_SCHEDULED' ? 'bg-gold-light/60 text-gold-dark border border-gold/25' :
                              'bg-gray-100 text-text-secondary border border-gray-200'
                            }`}>
                              {viewing.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex items-center justify-end gap-3">
                               <Link to={generateCarUrl(viewing.car as any)} className="text-[11px] font-bold text-text-tertiary hover:text-dark hover:underline transition-colors">
                                 View Car
                               </Link>
                               <Link to={`/viewing/${viewing.referenceNumber}`} className="text-[11px] font-bold text-gold-dark hover:text-dark hover:underline transition-colors px-3 py-1.5 bg-gold-light/60 rounded-lg">
                                 Details
                               </Link>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {viewings.length === 0 && (
                    <div className="py-16 text-center">
                      <p className="text-[12px] font-bold text-text-tertiary uppercase tracking-widest">No Viewings Found</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-6 animate-fade-up">
                <div className="flex justify-between items-end">
                   <h2 className="text-[20px] font-extrabold text-dark tracking-tight">Recently Viewed</h2>
                   <button
                    onClick={async () => {
                      await recentlyViewedService.clearAll();
                      fetchDashboardData();
                    }}
                    className="text-[10px] font-bold text-text-tertiary hover:text-gold-dark transition-colors bg-white border border-border px-3 py-1.5"
                   >
                     CLEAR HISTORY
                   </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
                  {recentlyViewed.map((item) => {
                    const car = item.car || item;
                    return (
                      <Link
                        key={car.id}
                        to={generateCarUrl(car)}
                        className="flex items-center gap-4 bg-white p-3 border border-border hover:bg-muted transition-colors no-underline text-dark group"
                      >
                        <div className="w-16 h-16 bg-muted overflow-hidden shrink-0 relative">
                          <img src={getCloudinaryThumbnail(getPrimaryImage(car.images)?.url, 160)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" onError={handleImageError} />
                          <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors duration-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-[12px] font-bold leading-tight truncate group-hover:text-gold-dark transition-colors">{car.title}</h4>
                          <p className="text-[12px] font-extrabold text-gold-dark mt-1 tracking-tight">MK {Number(car.basePrice).toLocaleString()}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
                {recentlyViewed.length === 0 && (
                   <div className="py-20 text-center flex flex-col items-center gap-3 border border-dashed border-border bg-white">
                     <History size={40} className="text-text-tertiary opacity-30" />
                     <p className="text-[13px] font-bold text-text-secondary">Your viewing history is empty.</p>
                   </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default CustomerDashboard;
