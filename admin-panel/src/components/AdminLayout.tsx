import { useState, useRef, useCallback, memo, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, CheckSquare, Target, Settings, LogOut,
  Search, Bell, Car, Users, LayoutGrid, Layers, MapPin, Activity, Tag, X,
  ChevronLeft, ChevronDown, Menu, Store, CheckCircle, MessageSquare, Eye, FileText, Image, HandCoins
, AlertTriangle, UserCircle } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { api } from '../lib/api';
/**
 * Sidebar navigation, grouped by how often an admin needs each area:
 * daily lead work first, then stock, then the catalogue/config long tail.
 * A flat 17-item list had become unscannable.
 *
 * Items can be dragged into a different order (within their group) — the
 * arrangement persists per role on this device. The sidebar edge is
 * draggable to resize. Help was removed as irrelevant.
 */
const NAV_SECTIONS = [
  {
    id: 'work',
    title: 'Daily Work',
    items: [
      { icon: LayoutDashboard, label: 'Overview', path: '/', roles: ['SUPER_ADMIN', 'SUB_ADMIN'] },
      { icon: MessageSquare, label: 'Customer Inquiries', path: '/leads', roles: ['SUPER_ADMIN', 'SUB_ADMIN'] },
      { icon: Eye, label: 'Viewings', path: '/viewings', roles: ['SUPER_ADMIN', 'SUB_ADMIN'] },
      { icon: HandCoins, label: 'Sell Requests', path: '/sell-requests', roles: ['SUPER_ADMIN', 'SUB_ADMIN'] },
      { icon: CheckCircle, label: 'Pending Approval', path: '/pending-approval', roles: ['SUPER_ADMIN', 'SUB_ADMIN'] },
    ],
  },
  {
    id: 'stock',
    title: 'Stock',
    items: [
      { icon: Car, label: 'Inventory', path: '/inventory', roles: ['SUPER_ADMIN', 'SUB_ADMIN', 'SELLER', 'MARKET_ATTENDANT'] },
      { icon: CheckSquare, label: 'Bulk Ops', path: '/bulk', roles: ['SUPER_ADMIN', 'SUB_ADMIN'] },
      { icon: Tag, label: 'Categories', path: '/categories', roles: ['SUPER_ADMIN'] },
      { icon: Image, label: 'Homepage Hero', path: '/hero-images', roles: ['SUPER_ADMIN', 'SUB_ADMIN'] },
    ],
  },
  {
    id: 'catalogue',
    title: 'Catalogue',
    items: [
      { icon: Layers, label: 'Makers & Models', path: '/maker-model', roles: ['SUPER_ADMIN', 'SUB_ADMIN'] },
      { icon: LayoutGrid, label: 'Body Types', path: '/body-type', roles: ['SUPER_ADMIN', 'SUB_ADMIN'] },
      { icon: MapPin, label: 'Districts & Logistics', path: '/locations', roles: ['SUPER_ADMIN', 'SUB_ADMIN'] },
      { icon: Store, label: 'Markets Ecosystem', path: '/markets', roles: ['SUPER_ADMIN', 'SUB_ADMIN'] },
      { icon: FileText, label: 'Content Pages', path: '/content-pages', roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    id: 'business',
    title: 'Business',
    items: [
      { icon: Target, label: 'Commissions', path: '/commissions', roles: ['SUPER_ADMIN', 'SUB_ADMIN'] },
      { icon: Users, label: 'Users', path: '/users', roles: ['SUPER_ADMIN'] },
      { icon: Activity, label: 'Activity', path: '/activity', roles: ['SUPER_ADMIN'] },
      { icon: AlertTriangle, label: 'System Errors', path: '/system-errors', roles: ['SUPER_ADMIN', 'SUB_ADMIN'] },
    ],
  },
];

const BOTTOM_ITEMS = [
  { icon: UserCircle, label: 'My Profile', path: '/profile', roles: ['SUPER_ADMIN', 'SUB_ADMIN', 'SELLER', 'MARKET_ATTENDANT'] },
  { icon: Settings, label: 'Settings', path: '/settings', roles: ['SUPER_ADMIN', 'SUB_ADMIN'] },
];

// ── Per-device persistence ─────────────────────────────────────────
const orderKey = (role: string) => `adminNavOrder:v1:${role}`;
const WIDTH_KEY = 'adminSidebarWidth';
const MIN_W = 170;
const MAX_W = 300;

const loadOrder = (role: string): Record<string, string[]> => {
  try {
    return JSON.parse(localStorage.getItem(orderKey(role)) || '{}');
  } catch {
    return {};
  }
};

const saveOrder = (role: string, order: Record<string, string[]>) => {
  try {
    localStorage.setItem(orderKey(role), JSON.stringify(order));
  } catch { /* storage unavailable — order just won't persist */ }
};

const loadWidth = (): number => {
  const w = Number(localStorage.getItem(WIDTH_KEY) || 0);
  return w >= MIN_W && w <= MAX_W ? w : 200;
};

// Stored order first (filtered to items that still exist), then anything new
// appended — so a feature added later still shows up for existing admins.
const applyOrder = <T extends { path: string }>(items: T[], stored?: string[]): T[] => {
  if (!stored?.length) return items;
  const byPath = new Map(items.map(i => [i.path, i]));
  const ordered = stored.map(p => byPath.get(p)).filter(Boolean) as T[];
  const seen = new Set(stored);
  return [...ordered, ...items.filter(i => !seen.has(i.path))];
};

const Sidebar = memo(({ collapsed, setCollapsed, mobileOpen, setMobileOpen, onLogout, userRole }: any) => {
  const [order, setOrder] = useState<Record<string, string[]>>(() => loadOrder(userRole));
  const [width, setWidth] = useState<number>(() => loadWidth());
  const [dragging, setDragging] = useState<{ section: string; path: string } | null>(null);
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef(width);

  const sections = NAV_SECTIONS
    .map(section => ({
      ...section,
      items: applyOrder(
        section.items.filter(item => !item.roles || item.roles.includes(userRole)),
        order[section.id]
      ),
    }))
    .filter(section => section.items.length > 0);

  const filteredBottomItems = BOTTOM_ITEMS.filter(item =>
    !item.roles || item.roles.includes(userRole)
  );

  // ── Drag to reorder (within a section) ─────────────────────────
  const handleDrop = (section: string, targetPath: string) => {
    if (!dragging || dragging.section !== section || dragging.path === targetPath) {
      setDragging(null);
      return;
    }
    const sec = sections.find(s => s.id === section);
    if (!sec) return;
    const paths = sec.items.map(i => i.path);
    const from = paths.indexOf(dragging.path);
    const to = paths.indexOf(targetPath);
    if (from === -1 || to === -1) return;
    paths.splice(to, 0, ...paths.splice(from, 1));
    const next = { ...order, [section]: paths };
    setOrder(next);
    saveOrder(userRole, next);
    setDragging(null);
  };

  // ── Edge drag to resize (desktop, expanded only) ───────────────
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setResizing(true);
    const startX = e.clientX;
    const startW = widthRef.current;

    const onMove = (ev: MouseEvent) => {
      const w = Math.min(MAX_W, Math.max(MIN_W, startW + (ev.clientX - startX)));
      widthRef.current = w;
      setWidth(w);
    };
    const onUp = () => {
      setResizing(false);
      try { localStorage.setItem(WIDTH_KEY, String(widthRef.current)); } catch { /* non-fatal */ }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // Dark navy rail — the same brand surface as the customer site's hero and
  // footer. Active item: gold marker + gold text on a soft white wash.
  const linkClasses = (isActive: boolean) => `
    group flex items-center gap-3 px-3 py-2 rounded-lg text-[12.5px] font-medium
    transition-colors duration-200 relative
    ${isActive
      ? 'bg-white/10 text-gold'
      : 'text-white/60 hover:text-white hover:bg-white/[0.07]'}
    ${collapsed ? 'justify-center' : ''}
  `;

  return (
    <aside
      style={{ width: collapsed ? 54 : width }}
      className={`
        fixed inset-y-0 left-0 z-50 flex flex-col bg-gradient-to-b from-dark to-dark-muted border-r border-white/5
        ${resizing ? '' : 'transition-[width] duration-300 ease-out'}
        lg:relative lg:translate-x-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center shrink-0">
            <Car size={16} className="text-dark" />
          </div>
          {!collapsed && (
            <span className="text-[14px] font-bold text-white truncate animate-fade-in">
              GaliMotors
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex w-6 h-6 items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ChevronLeft size={16} className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Navigation — grouped, most-used first, items draggable to reorder */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {sections.map(section => (
          <div key={section.id} className="mb-3 last:mb-0">
            {!collapsed ? (
              <p className="px-3 pt-1.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gold/70 select-none">
                {section.title}
              </p>
            ) : (
              <div className="mx-2 my-2 border-t border-white/10 first:hidden" />
            )}
            <div className="space-y-0.5">
              {section.items.map(item => (
                <div
                  key={item.path}
                  draggable={!collapsed}
                  onDragStart={() => setDragging({ section: section.id, path: item.path })}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDrop(section.id, item.path)}
                  onDragEnd={() => setDragging(null)}
                  className={dragging?.path === item.path ? 'opacity-40' : ''}
                >
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) => linkClasses(isActive)}
                    title={collapsed ? item.label : 'Drag to reorder'}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && !collapsed && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-gold rounded-r-full animate-fade-in" />
                        )}
                        <item.icon size={17} className={`shrink-0 transition-colors ${isActive ? 'text-gold' : ''}`} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                </div>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-white/10 py-2 px-2 space-y-0.5">
        {filteredBottomItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => linkClasses(isActive)}
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={17} className="shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
        <button onClick={onLogout} className={`
          flex items-center gap-3 px-3 py-2 rounded-lg text-[12.5px] font-medium
          text-white/60 hover:text-white hover:bg-white/[0.07] transition-all duration-200 w-full
          ${collapsed ? 'justify-center' : ''}
        `}>
          <LogOut size={17} className="shrink-0" />
          {!collapsed && <span>Log out</span>}
        </button>
      </div>

      {/* Resize handle — desktop, expanded only */}
      {!collapsed && (
        <div
          onMouseDown={startResize}
          title="Drag to resize"
          className={`hidden lg:block absolute top-0 right-0 h-full w-1.5 cursor-col-resize
            ${resizing ? 'bg-gold/40' : 'hover:bg-gold/25'} transition-colors`}
        />
      )}
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';

// ── Notification Types ─────────────────────────────────────────────
interface NotificationItem {
  id: string;
  title: string;
  subtitle: string;
  time: string;
  type: 'inquiry' | 'viewing' | 'sell_request';
  path: string;
  isNew: boolean;
}

// ── Search Result Types ────────────────────────────────────────────
interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: 'car' | 'lead' | 'sell_request';
  path: string;
}

// Format relative time
const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // User identity comes from the server-verified session, never localStorage.
  const userRole = user?.role || 'SUB_ADMIN';
  const userName = user?.name || 'User';
  const userEmail = user?.email || '';
  // Sellers and attendants live in their inventory only — the header search
  // and notifications query admin-only endpoints (leads, sell requests),
  // which would just 403 for them.
  const isStaff = userRole === 'SUPER_ADMIN' || userRole === 'SUB_ADMIN';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // ── Search state ─────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchDropdownOpen = searchFocused && (searchQuery.trim().length > 0 || searchLoading);

  // ── Notification state ───────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [lastSeenTime, setLastSeenTime] = useState<string>(() => {
    try { return localStorage.getItem('admin_notif_seen') || new Date(0).toISOString(); }
    catch { return new Date(0).toISOString(); }
  });

  // ── Profile dropdown state ───────────────────────────────────────
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // ── Close dropdowns on outside click ─────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchFocused(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Keyboard shortcut ⌘K / Ctrl+K ───────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        searchInputRef.current?.blur();
        setSearchFocused(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Debounced global search ──────────────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const q = searchQuery.trim();
        const res = await api.get(`/search?q=${encodeURIComponent(q)}`);
        const { cars = [], leads = [], sellRequests = [] } = res.data;
        const results: SearchResult[] = [];

        cars.forEach((c: any) => {
          results.push({
            id: c.id,
            title: c.title,
            subtitle: `${c.maker?.name || ''} ${c.model?.name || ''} • MK ${c.basePrice?.toLocaleString('en-US') || '—'}`,
            type: 'car',
            path: `/inventory?search=${c.id}`,
          });
        });

        leads.forEach((l: any) => {
          const isPaid = ['PAID_VIEWING_REQUEST', 'PAID_RESERVATION'].includes(l.type);
          results.push({
            id: l.id,
            title: `${l.buyerName} — ${l.referenceNumber || l.id.slice(0, 8)}`,
            subtitle: `${l.car?.title || 'No car'} • ${l.status.replace(/_/g, ' ')}`,
            type: 'lead',
            path: isPaid ? `/viewings?search=${l.id}` : `/leads?search=${l.id}`,
          });
        });

        sellRequests.forEach((r: any) => {
          results.push({
            id: r.id,
            title: r.name,
            subtitle: `Selling: ${r.carDetails?.slice(0, 50)}`,
            type: 'sell_request',
            path: `/sell-requests?search=${r.id}`,
          });
        });

        setSearchResults(results);
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  // Navigate to search result
  const handleSearchSelect = (result: SearchResult) => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchFocused(false);
    searchInputRef.current?.blur();
    navigate(result.path);
  };

  // Keyboard navigation in search results
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, searchResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && searchResults[selectedIndex]) {
      handleSearchSelect(searchResults[selectedIndex]);
    }
  };


  // ── Fetch notifications ──────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const items: NotificationItem[] = [];

      const [leadsRes, sellRes] = await Promise.allSettled([
        api.get('/leads'),
        api.get('/sell-requests'),
      ]);

      if (leadsRes.status === 'fulfilled') {
        const leads = leadsRes.value.data || [];
        // Show NEW inquiries and recent viewings pending verification
        leads
          .filter((l: any) => ['NEW', 'PENDING_VERIFICATION'].includes(l.status))
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10)
          .forEach((l: any) => {
            const isPaid = ['PAID_VIEWING_REQUEST', 'PAID_RESERVATION'].includes(l.type);
            items.push({
              id: l.id,
              title: l.status === 'PENDING_VERIFICATION'
                ? `Payment verification needed`
                : `New ${isPaid ? 'viewing request' : 'inquiry'}`,
              subtitle: `${l.buyerName} — ${l.car?.title || 'No car'}`,
              time: l.createdAt,
              type: isPaid ? 'viewing' : 'inquiry',
              path: isPaid ? '/viewings' : '/leads',
              isNew: new Date(l.createdAt) > new Date(lastSeenTime),
            });
          });
      }

      if (sellRes.status === 'fulfilled') {
        const requests = sellRes.value.data || [];
        requests
          .filter((r: any) => r.status === 'NEW')
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 5)
          .forEach((r: any) => {
            items.push({
              id: r.id,
              title: 'New sell request',
              subtitle: `${r.name} — ${r.carDetails?.slice(0, 40)}`,
              time: r.createdAt,
              type: 'sell_request',
              path: '/sell-requests',
              isNew: new Date(r.createdAt) > new Date(lastSeenTime),
            });
          });
      }

      // Sort all by time desc
      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setNotifications(items);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setNotifLoading(false);
    }
  }, [lastSeenTime]);

  // Initial fetch + poll every 60s (admins only — the endpoints are theirs)
  useEffect(() => {
    if (!isStaff) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications, isStaff]);

  const unreadCount = notifications.filter(n => n.isNew).length;

  const handleOpenNotifications = () => {
    setNotifOpen(!notifOpen);
    setProfileOpen(false);
    if (!notifOpen) {
      // Mark as seen
      const now = new Date().toISOString();
      setLastSeenTime(now);
      try { localStorage.setItem('admin_notif_seen', now); } catch { /* non-fatal */ }
    }
  };

  const handleNotifClick = (item: NotificationItem) => {
    setNotifOpen(false);
    navigate(item.path);
  };

  const notifTypeIcon = (type: string) => {
    switch (type) {
      case 'inquiry': return <MessageSquare size={15} className="text-blue-500" />;
      case 'viewing': return <Eye size={15} className="text-coral" />;
      case 'sell_request': return <HandCoins size={15} className="text-amber-500" />;
      default: return <Bell size={15} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-muted">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-dark/20 backdrop-blur-sm lg:hidden animate-fade-in" 
          onClick={() => setMobileOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <Sidebar 
        collapsed={collapsed} 
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onLogout={handleLogout}
        userRole={userRole}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 bg-surface border-b border-border shrink-0">
          <div className="flex items-center gap-3 flex-1">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden text-text-secondary hover:text-text-primary transition-colors">
              <Menu size={22} />
            </button>
            {/* ── Inline Search ── */}
            {isStaff && (
            <div className="relative hidden sm:block w-full max-w-md" ref={searchRef}>
              <div className={`flex items-center bg-muted rounded-xl px-3 py-2 border transition-all duration-200 ${
                searchFocused ? 'border-coral/40 ring-2 ring-coral/10 bg-surface shadow-sm' : 'border-transparent hover:border-border'
              }`}>
                {searchLoading ? (
                  <div className="w-4 h-4 border-2 border-coral/20 border-t-coral rounded-full animate-spin shrink-0" />
                ) : (
                  <Search size={16} className={`shrink-0 transition-colors duration-200 ${searchFocused ? 'text-coral' : 'text-text-tertiary'}`} />
                )}
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search cars, leads, requests…"
                  className="bg-transparent border-none outline-none text-[13px] w-full pl-2 text-text-primary placeholder:text-text-tertiary"
                />
                {searchQuery ? (
                  <button onClick={() => { setSearchQuery(''); setSearchResults([]); searchInputRef.current?.focus(); }} className="text-text-tertiary hover:text-text-primary transition-colors shrink-0">
                    <X size={14} />
                  </button>
                ) : (
                  <kbd className="hidden md:inline text-[10px] text-text-tertiary bg-surface border border-border rounded px-1.5 py-0.5 font-mono shrink-0">⌘K</kbd>
                )}
              </div>

              {/* ── Search Results Dropdown ── */}
              {searchDropdownOpen && (
                <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-surface rounded-xl shadow-2xl border border-border overflow-hidden z-[100]" style={{animation: 'fadeSlideDown 0.15s ease-out'}}>
                  {searchLoading && searchResults.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-5 h-5 border-2 border-coral/20 border-t-coral rounded-full animate-spin" />
                    </div>
                  ) : searchQuery.trim() && !searchLoading && searchResults.length === 0 ? (
                    <div className="py-8 px-4 text-center">
                      <Search size={28} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm font-medium text-text-secondary">No results found</p>
                      <p className="text-xs text-text-tertiary mt-1">Try a different search term</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <>
                      {/* Group: Cars */}
                      {searchResults.filter(r => r.type === 'car').length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 bg-muted/50 border-b border-border">
                            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                              <Car size={11} className="text-coral" /> Inventory
                            </span>
                          </div>
                          {searchResults.filter(r => r.type === 'car').map((result) => {
                            const globalIdx = searchResults.indexOf(result);
                            return (
                              <button
                                key={result.id}
                                onClick={() => handleSearchSelect(result)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all duration-100 ${
                                  globalIdx === selectedIndex ? 'bg-coral/5 border-l-2 border-coral' : 'hover:bg-muted/70 border-l-2 border-transparent'
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${globalIdx === selectedIndex ? 'bg-coral/10' : 'bg-gray-100'}`}>
                                  <Car size={14} className="text-coral" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-semibold text-text-primary truncate">{result.title}</p>
                                  <p className="text-[11px] text-text-tertiary truncate">{result.subtitle}</p>
                                </div>
                                <ChevronLeft size={14} className="text-text-tertiary rotate-180 shrink-0 opacity-0 group-hover:opacity-100" />
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {/* Group: Leads */}
                      {searchResults.filter(r => r.type === 'lead').length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 bg-muted/50 border-b border-border border-t">
                            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                              <MessageSquare size={11} className="text-blue-500" /> Leads & Viewings
                            </span>
                          </div>
                          {searchResults.filter(r => r.type === 'lead').map((result) => {
                            const globalIdx = searchResults.indexOf(result);
                            return (
                              <button
                                key={result.id}
                                onClick={() => handleSearchSelect(result)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all duration-100 ${
                                  globalIdx === selectedIndex ? 'bg-blue-50/60 border-l-2 border-blue-500' : 'hover:bg-muted/70 border-l-2 border-transparent'
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${globalIdx === selectedIndex ? 'bg-blue-50' : 'bg-gray-100'}`}>
                                  <MessageSquare size={14} className="text-blue-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-semibold text-text-primary truncate">{result.title}</p>
                                  <p className="text-[11px] text-text-tertiary truncate">{result.subtitle}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {/* Group: Sell Requests */}
                      {searchResults.filter(r => r.type === 'sell_request').length > 0 && (
                        <div>
                          <div className="px-3 py-1.5 bg-muted/50 border-b border-border border-t">
                            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
                              <HandCoins size={11} className="text-amber-500" /> Sell Requests
                            </span>
                          </div>
                          {searchResults.filter(r => r.type === 'sell_request').map((result) => {
                            const globalIdx = searchResults.indexOf(result);
                            return (
                              <button
                                key={result.id}
                                onClick={() => handleSearchSelect(result)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all duration-100 ${
                                  globalIdx === selectedIndex ? 'bg-amber-50/60 border-l-2 border-amber-500' : 'hover:bg-muted/70 border-l-2 border-transparent'
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${globalIdx === selectedIndex ? 'bg-amber-50' : 'bg-gray-100'}`}>
                                  <HandCoins size={14} className="text-amber-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-semibold text-text-primary truncate">{result.title}</p>
                                  <p className="text-[11px] text-text-tertiary truncate">{result.subtitle}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {/* Footer hints */}
                      <div className="flex items-center gap-4 px-3 py-2 border-t border-border bg-muted/30">
                        <span className="text-[10px] text-text-tertiary flex items-center gap-1"><kbd className="bg-surface border border-border rounded px-1 py-0.5 font-mono text-[9px]">↑↓</kbd> Navigate</span>
                        <span className="text-[10px] text-text-tertiary flex items-center gap-1"><kbd className="bg-surface border border-border rounded px-1 py-0.5 font-mono text-[9px]">↵</kbd> Open</span>
                        <span className="text-[10px] text-text-tertiary flex items-center gap-1 ml-auto"><kbd className="bg-surface border border-border rounded px-1 py-0.5 font-mono text-[9px]">esc</kbd> Close</span>
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {/* ── Notifications ── */}
            {isStaff && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={handleOpenNotifications}
                className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${
                  notifOpen ? 'bg-muted text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-muted'
                }`}
              >
                <Bell size={19} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-coral text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 ring-2 ring-surface">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification dropdown */}
              {notifOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-[380px] bg-surface rounded-xl shadow-2xl border border-border overflow-hidden z-[100] animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-bold text-text-primary">Notifications</h3>
                    {notifications.length > 0 && (
                      <span className="text-[10px] text-text-tertiary font-medium">{notifications.length} items</span>
                    )}
                  </div>
                  <div className="max-h-[360px] overflow-y-auto">
                    {notifLoading && notifications.length === 0 ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 border-2 border-coral/20 border-t-coral rounded-full animate-spin" />
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="py-10 text-center">
                        <Bell size={28} className="text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-text-tertiary">All caught up!</p>
                        <p className="text-xs text-text-tertiary mt-0.5">No new inquiries or requests</p>
                      </div>
                    ) : (
                      <div className="py-1">
                        {notifications.map(item => (
                          <button
                            key={item.id}
                            onClick={() => handleNotifClick(item)}
                            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/70 transition-colors"
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              item.type === 'inquiry' ? 'bg-blue-50' :
                              item.type === 'viewing' ? 'bg-coral-light' :
                              'bg-amber-50'
                            }`}>
                              {notifTypeIcon(item.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`text-[13px] font-semibold truncate ${item.isNew ? 'text-text-primary' : 'text-text-secondary'}`}>
                                  {item.title}
                                </p>
                                {item.isNew && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-coral shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] text-text-tertiary truncate mt-0.5">{item.subtitle}</p>
                            </div>
                            <span className="text-[10px] text-text-tertiary whitespace-nowrap shrink-0 mt-0.5">{timeAgo(item.time)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="border-t border-border px-4 py-2.5">
                      <button
                        onClick={() => { setNotifOpen(false); navigate('/leads'); }}
                        className="w-full text-center text-xs font-semibold text-coral hover:text-coral-dark transition-colors"
                      >
                        View all inquiries →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            <div className="w-px h-5 bg-border mx-1"></div>

            {/* ── Profile Dropdown ── */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
                className={`flex items-center gap-3 rounded-full pl-2 pr-3 py-1.5 border transition-all duration-200 ${
                  profileOpen 
                    ? 'bg-muted border-border shadow-sm' 
                    : 'bg-surface border-transparent hover:bg-muted hover:border-border'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-coral to-coral-dark flex items-center justify-center text-white text-[12px] font-bold shadow-sm ring-2 ring-white">
                  {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="hidden md:flex flex-col items-start justify-center -space-y-0.5">
                  <span className="text-[13px] font-bold text-gray-900">{userName}</span>
                  <span className="text-[11px] font-medium text-gray-500">{userRole.replace(/_/g, ' ')}</span>
                </div>
                <ChevronDown size={14} className={`hidden md:block text-gray-400 ml-1 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile dropdown */}
              {profileOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-[240px] bg-surface rounded-xl shadow-2xl border border-border overflow-hidden z-[100] animate-in fade-in slide-in-from-top-1 duration-150">
                  {/* User info header */}
                  <div className="px-4 py-3.5 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-coral to-coral-dark flex items-center justify-center text-white text-[13px] font-bold shadow-sm">
                        {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-text-primary truncate">{userName}</p>
                        <p className="text-[11px] text-text-tertiary truncate">{userEmail}</p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-coral bg-coral-light px-2 py-0.5 rounded-md uppercase tracking-wide">
                        {userRole.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1.5">
                    <button
                      onClick={() => { setProfileOpen(false); navigate('/profile'); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors"
                    >
                      <UserCircle size={15} className="text-text-tertiary" />
                      <span className="text-[13px] font-medium text-text-primary">My Profile</span>
                    </button>
                    {isStaff && (
                    <button
                      onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors"
                    >
                      <Settings size={15} className="text-text-tertiary" />
                      <span className="text-[13px] font-medium text-text-primary">Settings</span>
                    </button>
                    )}
                    {(userRole === 'SUPER_ADMIN') && (
                      <button
                        onClick={() => { setProfileOpen(false); navigate('/activity'); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors"
                      >
                        <Activity size={15} className="text-text-tertiary" />
                        <span className="text-[13px] font-medium text-text-primary">Activity Log</span>
                      </button>
                    )}
                  </div>

                  <div className="border-t border-border py-1.5">
                    <button
                      onClick={() => { setProfileOpen(false); handleLogout(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-50 transition-colors group"
                    >
                      <LogOut size={15} className="text-text-tertiary group-hover:text-red-500 transition-colors" />
                      <span className="text-[13px] font-medium text-text-primary group-hover:text-red-600 transition-colors">Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

