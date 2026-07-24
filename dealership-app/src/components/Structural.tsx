import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { Phone, MessageSquare, Menu, X, Search, User, Heart, LogOut, ChevronDown, ChevronRight } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { trackPixel } from '../lib/metaPixel';
import { useCustomerAuth } from '../lib/CustomerAuthContext';

export const Navbar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  // Auth state comes from the reactive context — updates instantly on
  // login/logout/expiry with no page reload.
  const { isAuthenticated, customer, logout } = useCustomerAuth();
  const customerName = customer?.name || '';
  const { phoneLink, whatsappLink, phoneDisplay } = useSettings();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const isCarsPage = location.pathname.startsWith('/cars');
  const isHomePage = location.pathname === '/' || isCarsPage;
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Sync search query with URL params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchParam = params.get('search') || '';
    setSearchQuery(searchParam);
  }, [location.search]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });

    const onClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) trackPixel('Search', { search_string: query });
    
    // If already on home/cars, update URL params without navigation
    if (isHomePage) {
      const params = new URLSearchParams(location.search);
      if (query) {
        params.set('search', query);
      } else {
        params.delete('search');
      }
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    } else {
      // Navigate from other pages
      navigate(query ? `/?search=${encodeURIComponent(query)}` : '/');
    }
    
    setMobileSearch(false);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    navigate('/');
  };

  const initial = customerName.charAt(0).toUpperCase();

  return (
    <>
      {/* ── Top utility bar ─────────────────────────────────────────── */}
      <div className="hidden sm:block bg-dark">
        <div className="page-container flex items-center justify-between h-9">
          <div className="flex items-center">
            <a
              href={phoneLink}
              className="flex items-center gap-2 text-[11.5px] font-medium text-white/70 hover:text-white transition-colors pr-5"
            >
              <Phone size={12} className="text-gold shrink-0" />
              <span className="tabular-nums tracking-wide">{phoneDisplay}</span>
            </a>
            <span className="w-px h-3.5 bg-white/15" aria-hidden="true" />
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[11.5px] font-medium text-white/70 hover:text-white transition-colors pl-5"
            >
              <MessageSquare size={12} className="text-gold shrink-0" />
              WhatsApp Support
            </a>
          </div>
          <Link
            to="/sell"
            className="group flex items-center gap-1.5 text-[11.5px] font-semibold text-gold hover:text-white transition-colors no-underline"
          >
            Sell Your Car
            <ChevronRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {/* ── Main navbar ─────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-50 bg-white transition-all duration-300 ${
          scrolled ? 'shadow-[0_1px_20px_rgba(0,0,0,0.06)] border-b border-transparent' : 'border-b border-border'
        }`}
      >
        <div className="page-container flex items-center gap-5 lg:gap-8 h-16">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 bg-coral flex items-center justify-center group-hover:bg-coral-dark transition-colors duration-200">
              <span className="text-gold font-extrabold text-[17px] leading-none">G</span>
            </div>
            <div className="leading-tight">
              <div className="text-[16px] font-extrabold tracking-tight text-dark">GaliMotors</div>
              <div className="text-[10.5px] font-medium text-text-secondary -mt-0.5">Malawi Car Broker</div>
            </div>
          </NavLink>

          {/* Search — desktop (always visible on home/cars) */}
          {isHomePage && (
            <form
              onSubmit={handleSearch}
              className="hidden md:flex flex-1 max-w-2xl items-center h-10 bg-muted border border-border focus-within:bg-white focus-within:border-gold-dark focus-within:ring-2 focus-within:ring-gold/30 transition-all duration-200"
            >
              <Search size={16} className="ml-3.5 text-text-tertiary shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by make, model, or year…"
                className="search-input flex-1 px-3 h-full text-[13.5px] bg-transparent"
              />
              <button
                type="submit"
                className="bg-coral text-white text-[12.5px] font-semibold tracking-wide px-5 h-full hover:bg-coral-dark transition-colors shrink-0"
              >
                Search
              </button>
            </form>
          )}

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {/* Mobile search toggle */}
            {isHomePage && (
              <button
                onClick={() => setMobileSearch(!mobileSearch)}
                className="md:hidden btn-ghost p-2.5"
                aria-label="Search"
              >
                <Search size={19} />
              </button>
            )}

            {/* Browse Cars — desktop. Back for good: / is now a curated
                showroom and /cars the full filterable grid, so this link
                finally leads somewhere distinct. */}
            <NavLink
              to="/cars"
              className={({ isActive }) =>
                `hidden lg:flex items-center h-16 px-3.5 text-[13px] transition-colors duration-200 border-b-2 ${
                  isActive
                    ? 'text-dark font-bold border-gold'
                    : 'text-text-secondary font-medium border-transparent hover:text-dark'
                }`
              }
            >
              Browse Cars
            </NavLink>

            {/* Favorites */}
            <NavLink
              to="/favorites"
              className={({ isActive }) =>
                `p-2.5 transition-colors duration-200 ${
                  isActive ? 'text-gold-dark' : 'text-text-secondary hover:text-dark'
                }`
              }
              aria-label="Favourites"
              title="Favourites"
            >
              <Heart size={19} />
            </NavLink>

            {/* Auth */}
            {isAuthenticated ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 pl-1.5 pr-2.5 h-10 ml-1 hover:bg-muted transition-colors text-[13px] font-medium text-text-primary"
                >
                  <span className="w-7 h-7 bg-coral text-gold flex items-center justify-center text-[11px] font-bold shrink-0">
                    {initial}
                  </span>
                  <span className="hidden sm:inline max-w-[90px] truncate">{customerName.split(' ')[0]}</span>
                  <ChevronDown size={14} className={`text-text-tertiary transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-border shadow-xl shadow-black/10 py-2 animate-fade-scale origin-top-right z-50">
                    <div className="px-5 py-3 border-b border-border/60 mb-1">
                      <p className="text-[13px] font-bold text-dark truncate">{customerName}</p>
                      <p className="text-[11px] text-text-tertiary truncate">Member</p>
                    </div>
                    <button
                      onClick={() => { navigate('/dashboard'); setUserMenuOpen(false); }}
                      className="w-full text-left px-5 py-2.5 text-[13px] font-medium text-text-primary hover:bg-muted hover:text-gold-dark transition-colors"
                    >
                      My Dashboard
                    </button>
                    <button
                      onClick={() => { navigate('/favorites'); setUserMenuOpen(false); }}
                      className="w-full text-left px-5 py-2.5 text-[13px] font-medium text-text-primary hover:bg-muted hover:text-gold-dark transition-colors"
                    >
                      Saved Cars
                    </button>
                    <div className="border-t border-border/60 mt-1 pt-1">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-5 py-2.5 text-[13px] font-medium text-danger hover:bg-danger-light transition-colors flex items-center gap-2"
                      >
                        <LogOut size={14} /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => (window as any).openLoginModal?.()}
                className="flex items-center gap-1.5 h-10 px-2.5 sm:px-4 ml-1 text-[13px] font-semibold text-text-primary border border-border hover:border-coral hover:text-coral transition-colors"
              >
                <User size={16} />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2.5 hover:bg-muted transition-colors text-text-secondary"
              aria-label="Menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile search bar */}
        {mobileSearch && isHomePage && (
          <div className="md:hidden border-t border-border/60 px-4 py-3 animate-slide-up shadow-inner bg-gray-50/50">
            <form onSubmit={handleSearch} className="flex items-center gap-2 bg-white px-3 h-11 border border-border shadow-sm focus-within:border-gold-dark focus-within:ring-2 focus-within:ring-gold/30 transition-all">
              <Search size={15} className="text-text-tertiary shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search make, model, year…"
                className="search-input flex-1 bg-transparent"
                autoFocus
              />
              <button type="submit" className="text-gold-dark font-bold text-[13px] shrink-0 px-1">Go</button>
              {/* Explicit way out — the bar previously could only be closed by
                  tapping the toggle icon again, which nobody discovers. */}
              <button
                type="button"
                onClick={() => { setMobileSearch(false); setSearchQuery(''); }}
                aria-label="Close search"
                className="shrink-0 p-1.5 -mr-1 text-text-tertiary hover:text-dark transition-colors"
              >
                <X size={16} />
              </button>
            </form>
          </div>
        )}

        {/* Mobile menu */}
        {mobileOpen && (
          <nav className="lg:hidden border-t border-border/60 bg-white animate-slide-up shadow-xl shadow-black/5 absolute w-full">
            <div className="page-container py-4 space-y-1.5">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `block py-3 px-4 text-[14px] font-semibold transition-colors border-l-2 ${
                    isActive ? 'text-dark border-gold bg-muted' : 'text-text-primary border-transparent hover:bg-muted'
                  }`
                }
                onClick={() => setMobileOpen(false)}
              >
                Home
              </NavLink>
              <NavLink
                to="/cars"
                className={({ isActive }) =>
                  `block py-3 px-4 text-[14px] font-semibold transition-colors border-l-2 ${
                    isActive ? 'text-dark border-gold bg-muted' : 'text-text-primary border-transparent hover:bg-muted'
                  }`
                }
                onClick={() => setMobileOpen(false)}
              >
                Browse Cars
              </NavLink>
              <NavLink
                to="/favorites"
                className={({ isActive }) =>
                  `block py-3 px-4 text-[14px] font-semibold transition-colors border-l-2 ${
                    isActive ? 'text-dark border-gold bg-muted' : 'text-text-primary border-transparent hover:bg-muted'
                  }`
                }
                onClick={() => setMobileOpen(false)}
              >
                Saved Cars
              </NavLink>
              <Link
                to="/sell"
                className="block py-3 px-4 text-[14px] font-semibold text-gold-dark border-l-2 border-transparent hover:bg-muted transition-colors no-underline"
                onClick={() => setMobileOpen(false)}
              >
                Sell Your Car
              </Link>
            </div>
            <div className="border-t border-border/60 page-container py-5 flex gap-3 bg-gray-50">
              <a
                href={phoneLink}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-border shadow-sm hover:shadow-md rounded-xl text-[13px] font-bold text-text-primary transition-all"
              >
                <Phone size={14} className="text-gold-dark" /> Call
              </a>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-dark hover:bg-coral-dark shadow-sm hover:shadow-md shadow-dark/20 rounded-xl text-[13px] font-bold text-white transition-all [&>svg]:text-[#25D366]"
              >
                <MessageSquare size={14} /> WhatsApp
              </a>
            </div>
          </nav>
        )}
      </header>
    </>
  );
};
