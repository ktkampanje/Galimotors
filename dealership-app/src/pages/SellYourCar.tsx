import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { User, Phone, MapPin, Car, CheckCircle2, MessageCircle, BadgeCheck, Users, Wallet } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../lib/api';
import { useSettings } from '../hooks/useSettings';
import { isValidMalawianPhone, normaliseMalawianPhone, MALAWI_PHONE_HINT } from '../lib/phone';
import { trackPixel } from '../lib/metaPixel';

/**
 * Sell Your Car — an owner asks GaliMotors to sell for them.
 *
 * The navbar and footer linked to /sell all along, but no page existed. The
 * form saves a SellRequest for the admin panel, then offers a prefilled
 * WhatsApp handoff — the channel the follow-up actually happens on.
 */
const SellYourCar: React.FC = () => {
  const { whatsappLink } = useSettings();
  const [districts, setDistricts] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    district: '',
    carDetails: '',
    expectedPrice: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/locations/districts`)
      .then(r => setDistricts(r.data || []))
      .catch(() => setDistricts([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.carDetails.trim()) {
      setError('Please fill in your name and the car details.');
      return;
    }
    if (!isValidMalawianPhone(form.phone)) {
      setError(MALAWI_PHONE_HINT);
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API_BASE_URL}/sell-requests`, {
        name: form.name.trim(),
        phone: normaliseMalawianPhone(form.phone),
        district: form.district || undefined,
        carDetails: form.carDetails.trim(),
        expectedPrice: form.expectedPrice.replace(/,/g, '') || undefined,
      });
      setSubmitted(true);
      trackPixel('Lead', { content_name: 'Sell request' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const waHref = `${whatsappLink}?text=${encodeURIComponent(
    `Hi GaliMotors, I just submitted a request to sell my car. My name is ${form.name.trim() || '…'}.\n\nCar: ${form.carDetails.trim().slice(0, 200)}`
  )}`;

  return (
    <>
      <Helmet>
        <title>Sell Your Car | GaliMotors</title>
        <meta
          name="description"
          content="Sell your car through GaliMotors. We inspect, list and market your vehicle to serious buyers across Malawi — you set your price."
        />
      </Helmet>

      <div className="page-container py-8 sm:py-12 max-w-3xl">
        {submitted ? (
          /* ── Success ─────────────────────────────── */
          <div className="text-center py-10 animate-fade-up">
            <div className="w-14 h-14 mx-auto bg-success-light flex items-center justify-center rounded-full mb-5">
              <CheckCircle2 size={28} className="text-success" />
            </div>
            <h1 className="text-[24px] sm:text-[28px] font-extrabold text-dark tracking-tight">
              Request received
            </h1>
            <p className="text-[14px] text-text-secondary mt-2 max-w-md mx-auto leading-relaxed">
              Thank you, {form.name.split(' ')[0]}. Our team will call or message
              you on <span className="font-semibold text-dark">{normaliseMalawianPhone(form.phone)}</span> within
              24 hours to arrange an inspection.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-7">
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1fb85a] text-white font-bold text-sm px-6 py-3 transition-colors no-underline"
              >
                <MessageCircle size={17} /> Chat with us now on WhatsApp
              </a>
              <Link to="/" className="btn-outline px-6">Back to homepage</Link>
            </div>
          </div>
        ) : (
          <>
            {/* ── Pitch ───────────────────────────── */}
            <h1 className="text-[24px] sm:text-[30px] font-extrabold text-dark tracking-tight leading-tight">
              Sell your car through GaliMotors
            </h1>
            <p className="text-[14px] sm:text-[15px] text-text-secondary mt-2 leading-relaxed">
              Tell us about your car. We inspect it, list it with professional
              photos, and bring you serious buyers — you stay in control of the
              price.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
              {[
                { icon: BadgeCheck, title: 'Verified listing', text: 'Inspected and badged, so buyers trust it' },
                { icon: Users, title: 'Real buyers', text: 'Marketed to customers across Malawi' },
                { icon: Wallet, title: 'Your price', text: 'You set the amount you want to take' },
              ].map(b => (
                <div key={b.title} className="border border-border bg-muted/30 p-4">
                  <b.icon size={18} className="text-gold-dark mb-2" />
                  <p className="text-[13px] font-bold text-dark">{b.title}</p>
                  <p className="text-[12px] text-text-secondary mt-0.5 leading-snug">{b.text}</p>
                </div>
              ))}
            </div>

            {/* ── Form ────────────────────────────── */}
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {error && (
                <div className="bg-danger-light border border-danger/20 text-danger p-3.5 text-sm font-medium animate-fade-up">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text-secondary">Full Name *</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="field pl-10"
                      placeholder="John Banda"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text-secondary">Phone Number *</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                    <input
                      type="tel"
                      inputMode="tel"
                      required
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="field pl-10"
                      placeholder="0952456789"
                    />
                  </div>
                  <p className="text-[11.5px] text-text-tertiary">We follow up on WhatsApp — 10 digits starting 08 or 09.</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-secondary">Your District</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                  <select
                    value={form.district}
                    onChange={e => setForm({ ...form, district: e.target.value })}
                    className="field pl-10 appearance-none cursor-pointer"
                  >
                    <option value="">Select district…</option>
                    {districts.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-secondary">About the Car *</label>
                <div className="relative">
                  <Car size={16} className="absolute left-3 top-3.5 text-text-tertiary" />
                  <textarea
                    required
                    rows={4}
                    value={form.carDetails}
                    onChange={e => setForm({ ...form, carDetails: e.target.value })}
                    className="field pl-10 resize-none"
                    placeholder="e.g. 2014 Toyota Hilux, manual, diesel, 120,000 km, clean interior, duty paid…"
                  />
                </div>
                <p className="text-[11.5px] text-text-tertiary">
                  Make, model, year, mileage, condition — anything a buyer should know.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-secondary">Price You Want (MK, optional)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.expectedPrice}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setForm({ ...form, expectedPrice: digits ? parseInt(digits, 10).toLocaleString('en-US') : '' });
                  }}
                  className="field"
                  placeholder="e.g. 30,000,000"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full sm:w-auto px-10 disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Submit — we contact you within 24 hours'}
              </button>
            </form>
          </>
        )}
      </div>
    </>
  );
};

export default SellYourCar;
