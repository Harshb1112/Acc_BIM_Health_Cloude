'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '@/components/Layout';
import {
  Check, CreditCard, Zap, Shield, Star,
  Upload, Clock, CheckCircle, XCircle,
  AlertCircle, ImageIcon, Send, RefreshCw, Calendar
} from 'lucide-react';

interface Plan {
  id: number;
  planId: string;
  name: string;
  duration: number;
  price: number;
  currency: string;
  description?: string;
  isPopular: boolean;
}

interface PaymentRequest {
  id: number;
  plan: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  createdAt: string;
}

const FEATURES = [
  'Unlimited BIM health reports',
  'Advanced analytics & charts',
  'ACC / BIM 360 cloud integration',
  'Export PDF, Excel & JSON',
  'Priority email support',
  'Revit 2023 – 2027 support',
];

const PAYPAL_EMAIL = 'drashti.barot@krishnaos.com';

function StatusBadge({ status }: { status: string }) {
  if (status === 'pending')
    return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800"><Clock size={12}/>Pending Review</span>;
  if (status === 'approved')
    return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800"><CheckCircle size={12}/>Approved</span>;
  return <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800"><XCircle size={12}/>Rejected</span>;
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<any>(null);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [step, setStep] = useState<'plans' | 'upload'>('plans');
  const [myRequests, setMyRequests] = useState<PaymentRequest[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [transactionNote, setTransactionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPlans = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const res = await fetch('/api/plans');
      const data = await res.json();
      if (data.success) setPlans(data.plans || []);
    } catch (_) {}
    finally { setLoadingPlans(false); }
  }, []);

  const fetchMyRequests = useCallback(async () => {
    setLoadingReqs(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/payment/request', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setMyRequests(data.requests || []);
    } catch (_) {}
    finally { setLoadingReqs(false); }
  }, []);

  const fetchSubscription = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setSubscription(null);
      setDaysRemaining(0);
      localStorage.removeItem('subscription');
      return;
    }

    try {
      const res = await fetch('/api/auth/subscription', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.status === 401) {
        setSubscription(null);
        setDaysRemaining(0);
        localStorage.removeItem('subscription');
        return;
      }

      const data = await res.json();
      if (data.success) {
        const activeSubscription = data.subscription || null;
        setSubscription(activeSubscription);
        setDaysRemaining(activeSubscription
          ? Math.ceil((new Date(activeSubscription.endDate).getTime() - Date.now()) / 86400000)
          : 0);
        if (activeSubscription) localStorage.setItem('subscription', JSON.stringify(activeSubscription));
        else localStorage.removeItem('subscription');
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchMyRequests();
    fetchSubscription();
  }, [fetchPlans, fetchMyRequests, fetchSubscription]);

  useEffect(() => {
    const refreshBilling = () => {
      if (document.visibilityState === 'visible') {
        void fetchPlans();
        void fetchSubscription();
      }
    };
    window.addEventListener('focus', refreshBilling);
    const refreshInterval = window.setInterval(refreshBilling, 30_000);
    return () => {
      window.removeEventListener('focus', refreshBilling);
      window.clearInterval(refreshInterval);
    };
  }, [fetchPlans, fetchSubscription]);

  const getPlanName = (planId: string) =>
    plans.find(p => p.planId === planId)?.name
    || planId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const selectedPlanData = plans.find(p => p.planId === selectedPlan);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File too large. Max 5 MB.'); return; }
    setScreenshotFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenshotFile) { alert('Please select a screenshot.'); return; }
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const token = localStorage.getItem('accessToken');
      const form = new FormData();
      form.append('plan', selectedPlan);
      form.append('screenshot', screenshotFile);
      form.append('paypalEmail', paypalEmail);
      form.append('transactionNote', transactionNote);
      const res = await fetch('/api/payment/request', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (data.success) {
        setSubmitResult({ ok: true, msg: data.message });
        setScreenshotFile(null); setPreviewUrl('');
        setPaypalEmail(''); setTransactionNote('');
        setStep('plans'); fetchMyRequests();
      } else {
        setSubmitResult({ ok: false, msg: data.error || 'Submission failed.' });
      }
    } catch (_) {
      setSubmitResult({ ok: false, msg: 'Network error. Please try again.' });
    } finally { setSubmitting(false); }
  };

  // ── Active subscription — hide plans if still active (>5 days)
  const isActive = subscription && daysRemaining > 5;
  const isExpiringSoon = subscription && daysRemaining > 0 && daysRemaining <= 5;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">💳 Subscription & Billing</h1>
          <p className="text-gray-600 text-lg">Pay via PayPal · Upload screenshot · Get activated within 24 h</p>
        </div>

        {/* Submit result banner */}
        {submitResult && (
          <div className={`mb-6 flex items-start gap-3 p-4 rounded-xl border ${submitResult.ok ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
            {submitResult.ok ? <CheckCircle size={20} className="shrink-0"/> : <XCircle size={20} className="shrink-0"/>}
            <p className="text-sm font-medium">{submitResult.msg}</p>
          </div>
        )}

        {/* Active subscription card */}
        {subscription && daysRemaining > 0 && (
          <div className={`rounded-2xl shadow-lg p-7 mb-10 text-white ${subscription.isTrial ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-blue-600 to-purple-600'}`}>
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold mb-1">
                  {subscription.isTrial ? '🎁 Free Trial Active' : '✨ Premium Subscription'}
                </h2>
                <p className="text-white/80 text-sm">{getPlanName(subscription.plan)}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-5xl font-black">{daysRemaining}</div>
                <div className="text-white/80 text-sm">Days remaining</div>
              </div>
            </div>
            <div className="mt-4 bg-white/20 rounded-lg px-4 py-2 flex justify-between text-sm">
              <span className="flex items-center gap-2"><Calendar size={14}/>Valid until</span>
              <span className="font-semibold">
                {new Date(subscription.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            {isExpiringSoon && (
              <div className="mt-3 bg-yellow-400/30 border border-yellow-300/50 rounded-lg px-4 py-2 text-sm font-semibold">
                ⚠️ Subscription ending in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}! Renew below.
              </div>
            )}
          </div>
        )}

        {/* Show "subscribe" section only if no active sub OR expiring soon */}
        {!isActive && (
          <>
            {/* How it works */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-10">
              <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                <AlertCircle size={20}/> How to Subscribe
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
                {[
                  { n:1, icon:'💰', title:'Choose Plan',        sub:'Select below' },
                  { n:2, icon:'📲', title:'Pay via PayPal',     sub: PAYPAL_EMAIL },
                  { n:3, icon:'📸', title:'Upload Screenshot',  sub:'Confirm receipt' },
                  { n:4, icon:'✅', title:'Get Activated',      sub:'Within 24 hours' },
                ].map(s => (
                  <div key={s.n} className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
                    <div className="text-3xl mb-2">{s.icon}</div>
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full text-xs font-bold flex items-center justify-center mx-auto mb-2">{s.n}</div>
                    <div className="font-semibold text-gray-800 text-sm">{s.title}</div>
                    <div className="text-xs text-gray-500 mt-1">{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Plans / Upload step */}
            {step === 'plans' ? (
              <>
                {/* Plans grid */}
                {loadingPlans ? (
                  <div className="flex items-center justify-center py-16">
                    <RefreshCw size={28} className="animate-spin text-blue-500"/>
                    <span className="ml-3 text-gray-500">Loading plans...</span>
                  </div>
                ) : (
                  <div className={`grid grid-cols-1 ${plans.length === 1 ? 'max-w-sm mx-auto' : 'sm:grid-cols-2 max-w-2xl mx-auto'} gap-6 mb-10`}>
                    {plans.map(plan => (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan.planId)}
                        className={`relative cursor-pointer rounded-2xl border-2 p-6 transition-all hover:shadow-xl hover:-translate-y-1 ${selectedPlan === plan.planId ? 'border-blue-600 shadow-xl bg-blue-50' : plan.isPopular ? 'border-purple-400 shadow-lg bg-white' : 'border-gray-200 bg-white'}`}
                      >
                        {plan.isPopular && (
                          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                            <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                              <Star size={10}/> BEST VALUE
                            </span>
                          </div>
                        )}
                        {selectedPlan === plan.planId && (
                          <div className="absolute top-3 right-3 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                            <Check size={14} className="text-white"/>
                          </div>
                        )}
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-4xl font-black text-blue-600">${plan.price}</span>
                          <span className="text-gray-400 text-sm">{plan.currency}</span>
                        </div>
                        <p className="text-xs text-gray-500 mb-1">{plan.duration} days access</p>
                        {plan.description && <p className="text-xs text-gray-400 mb-3 italic">{plan.description}</p>}
                        <ul className="space-y-1.5 mt-2">
                          {FEATURES.map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                              <Check size={12} className="text-green-500 shrink-0 mt-0.5"/>{f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {/* PayPal payment info */}
                {selectedPlan && (
                  <div className="bg-white border-2 border-blue-200 rounded-2xl p-6 mb-6 shadow-md">
                    <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
                      <CreditCard size={20} className="text-blue-600"/> Step 2 — Pay via PayPal
                    </h3>
                    <div className="bg-blue-50 rounded-xl px-5 py-4 text-center mb-4">
                      <div className="text-sm text-gray-500 mb-1">Send payment to</div>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-xl font-bold text-blue-700 font-mono">{PAYPAL_EMAIL}</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(PAYPAL_EMAIL); alert('Email copied!'); }}
                          className="text-xs bg-blue-200 hover:bg-blue-300 text-blue-800 px-2 py-1 rounded-lg transition"
                        >Copy</button>
                      </div>
                      <div className="text-sm text-gray-500 mt-2">
                        Amount: <span className="font-bold text-gray-800 text-lg">${selectedPlanData?.price} USD</span>
                      </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800 mb-3">
                      ⚠️ <strong>Important:</strong> In PayPal note write your registered email address
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 mb-4">
                      <p className="font-semibold mb-2">📋 Steps:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs text-gray-600">
                        <li>Go to <a href="https://www.paypal.com/myaccount/transfer/homepage/pay" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-semibold">paypal.com → Send Money</a></li>
                        <li>Enter: <strong className="font-mono">{PAYPAL_EMAIL}</strong></li>
                        <li>Amount: <strong>${selectedPlanData?.price} USD</strong></li>
                        <li>Take screenshot → upload below</li>
                      </ol>
                    </div>

                    <button
                      onClick={() => setStep('upload')}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3 rounded-xl hover:opacity-90 transition flex items-center justify-center gap-2"
                    >
                      <Upload size={18}/> I&apos;ve Paid — Upload Screenshot
                    </button>
                  </div>
                )}

                {!selectedPlan && !loadingPlans && (
                  <p className="text-center text-gray-400 text-sm mb-6">👆 Click a plan above to get started</p>
                )}
              </>
            ) : (
              /* Upload form */
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-10">
                <button onClick={() => setStep('plans')} className="text-blue-600 hover:underline text-sm mb-6 flex items-center gap-1">
                  ← Back to plans
                </button>
                <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Upload size={22} className="text-blue-600"/> Upload Payment Screenshot
                </h2>
                <p className="text-gray-500 text-sm mb-6">
                  Plan: <strong>{selectedPlanData?.name} — ${selectedPlanData?.price}</strong>
                </p>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Screenshot <span className="text-red-500">*</span></label>
                    <div onClick={() => fileRef.current?.click()} className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${previewUrl ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}>
                      {previewUrl ? (
                        <div>
                          <img src={previewUrl} alt="screenshot" className="max-h-48 mx-auto rounded-lg object-contain mb-2"/>
                          <p className="text-green-700 text-sm font-medium">{screenshotFile?.name}</p>
                          <p className="text-xs text-gray-400 mt-1">Click to change</p>
                        </div>
                      ) : (
                        <div>
                          <ImageIcon size={40} className="mx-auto text-gray-300 mb-3"/>
                          <p className="text-gray-600 font-medium">Click to upload screenshot</p>
                          <p className="text-gray-400 text-xs mt-1">JPG, PNG, WEBP · Max 5 MB</p>
                        </div>
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden"/>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">PayPal Email You Paid From</label>
                    <input type="email" value={paypalEmail} onChange={e => setPaypalEmail(e.target.value)} placeholder="your-paypal@email.com" className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction Note / ID <span className="text-gray-400 font-normal">(optional)</span></label>
                    <textarea value={transactionNote} onChange={e => setTransactionNote(e.target.value)} rows={3} placeholder="Paste PayPal transaction ID..." className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"/>
                  </div>
                  <button type="submit" disabled={submitting || !screenshotFile} className="w-full bg-gradient-to-r from-green-600 to-teal-600 text-white font-bold py-4 rounded-xl hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2 text-lg">
                    {submitting ? <><RefreshCw size={20} className="animate-spin"/> Submitting...</> : <><Send size={20}/> Submit for Review</>}
                  </button>
                  <p className="text-xs text-gray-400 text-center">Admin will review and activate within 24 hours.</p>
                </form>
              </div>
            )}
          </>
        )}

        {/* My Payment History */}
        <div className="bg-white rounded-2xl shadow border border-gray-200 p-6 mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Clock size={18} className="text-blue-600"/> My Payment History</h3>
            <button onClick={fetchMyRequests} className="text-sm text-blue-600 hover:underline flex items-center gap-1"><RefreshCw size={14}/> Refresh</button>
          </div>
          {loadingReqs ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : myRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Clock size={32} className="mx-auto mb-2 opacity-40"/>
              <p className="text-sm">No payment requests yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase border-b">
                    {['#','Plan','Amount','Status','Admin Note','Date'].map(h => <th key={h} className="pb-2 text-left px-2">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {myRequests.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="py-3 px-2 text-gray-400">#{r.id}</td>
                      <td className="py-3 px-2 font-medium text-gray-800">{getPlanName(r.plan)}</td>
                      <td className="py-3 px-2 text-gray-700">${r.amount}</td>
                      <td className="py-3 px-2"><StatusBadge status={r.status}/></td>
                      <td className="py-3 px-2 text-gray-500 text-xs max-w-xs truncate">{r.adminNote || '—'}</td>
                      <td className="py-3 px-2 text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Why us */}
        <div className="bg-white rounded-2xl shadow border border-gray-200 p-8">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-6">Why BIM Health Report?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {[
              { icon: <Zap size={32} className="text-blue-500"/>,      title: 'Lightning Fast',  sub: 'Reports in seconds' },
              { icon: <Shield size={32} className="text-green-500"/>,   title: 'Secure & Private', sub: 'Your data encrypted' },
              { icon: <CreditCard size={32} className="text-purple-500"/>, title: 'Easy Payment', sub: 'PayPal, no card needed' },
            ].map((x, i) => (
              <div key={i}>
                <div className="flex justify-center mb-3">{x.icon}</div>
                <h3 className="font-semibold text-gray-900">{x.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{x.sub}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </Layout>
  );
}
