'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircle, XCircle, Clock, Eye, RefreshCw,
  Users, DollarSign, AlertCircle, BarChart3,
  Image as ImageIcon, X, Send, Lock, TrendingUp
} from 'lucide-react';

const ADMIN_TOKEN_KEY = 'admin_token';

const PLAN_LABEL: Record<string, string> = {
  '1_month':   '1 Month — $10',
  '12_months': '1 Year — $100',
};

interface PaymentReq {
  id: number;
  plan: string;
  amount: number;
  currency: string;
  paypalEmail?: string;
  screenshotUrl: string;
  transactionNote?: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
  user: { id: number; name: string; email: string };
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === 'pending')
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800"><Clock size={11}/>Pending</span>;
  if (status === 'approved')
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800"><CheckCircle size={11}/>Approved</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800"><XCircle size={11}/>Rejected</span>;
}

// ────────────────────────────────────────────────────────────────────────────
export default function AdminPaymentsPage() {
  const searchParams = useSearchParams();

  // Auth state
  const [authed, setAuthed]         = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [authError, setAuthError]   = useState('');

  // Data state
  const [requests, setRequests]   = useState<PaymentReq[]>([]);
  const [stats, setStats]         = useState<Stats>({ total:0, pending:0, approved:0, rejected:0 });
  const [filter, setFilter]       = useState<'pending'|'all'>('pending');
  const [loading, setLoading]     = useState(false);
  const [actionResult, setActionResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Modal state
  const [viewReq, setViewReq]       = useState<PaymentReq | null>(null);
  const [actionReq, setActionReq]   = useState<PaymentReq | null>(null);
  const [actionType, setActionType] = useState<'approve'|'reject'>('approve');
  const [adminNote, setAdminNote]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Check stored token on mount ──────────────────────────────────────────
  useEffect(() => {
    const stored = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (stored) setAuthed(true);
  }, []);

  // ── Handle URL params from email quick-action redirects ─────────────────
  useEffect(() => {
    const success = searchParams.get('success');
    const error   = searchParams.get('error');
    const user    = searchParams.get('user');
    const id      = searchParams.get('id');

    if (success === 'approved') {
      setActionResult({ ok: true,  msg: `✅ Request #${id} approved. ${user} is now activated.` });
    } else if (success === 'rejected') {
      setActionResult({ ok: false, msg: `❌ Request #${id} rejected. ${user} has been notified.` });
    } else if (error === 'already_approved') {
      setActionResult({ ok: true,  msg: `ℹ️ Request #${id} was already approved.` });
    } else if (error === 'already_rejected') {
      setActionResult({ ok: false, msg: `ℹ️ Request #${id} was already rejected.` });
    } else if (error === 'unauthorized') {
      setActionResult({ ok: false, msg: '🔒 Invalid admin token.' });
    }
  }, [searchParams]);

  // ── Fetch data ───────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/payments?status=${filter}`, {
        headers: { 'x-admin-token': token },
      });
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests);
        setStats(data.stats);
      }
    } catch (_) {}
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => {
    if (authed) fetchData();
  }, [authed, fetchData]);

  // ── Login ────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // Verify by calling the API
    const res = await fetch('/api/admin/payments?status=pending', {
      headers: { 'x-admin-token': tokenInput },
    });
    if (res.ok) {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, tokenInput);
      setAuthed(true);
      setAuthError('');
    } else {
      setAuthError('Wrong admin token. Check your .env ADMIN_SECRET_TOKEN.');
    }
  };

  // ── Approve / Reject ─────────────────────────────────────────────────────
  const handleAction = async () => {
    if (!actionReq) return;
    setSubmitting(true);
    try {
      const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
      const res   = await fetch('/api/admin/payments', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'x-admin-token': token || '',
        },
        body: JSON.stringify({
          action:    actionType,
          requestId: actionReq.id,
          adminNote: adminNote || undefined,
        }),
      });
      const data = await res.json();
      setActionResult({ ok: data.success, msg: data.message || data.error });
      if (data.success) {
        setActionReq(null);
        setAdminNote('');
        fetchData();
      }
    } catch (_) {
      setActionResult({ ok: false, msg: 'Network error.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  // ── LOGIN GATE ───────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Lock size={32} className="text-white"/>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-500 text-sm mt-1">BIM Health Report</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Admin Token</label>
              <input
                type="password"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder="Enter ADMIN_SECRET_TOKEN"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                required
              />
            </div>
            {authError && (
              <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{authError}</p>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition"
            >
              Login
            </button>
          </form>
          <p className="text-xs text-gray-400 text-center mt-4">
            Token is set in <code className="bg-gray-100 px-1 rounded">.env → ADMIN_SECRET_TOKEN</code>
          </p>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  // ── MAIN ADMIN UI ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-gray-900 to-blue-900 text-white shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">🏗️ BIM Health Report — Admin</h1>
            <p className="text-blue-200 text-xs mt-0.5">Payment Requests Management</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-sm px-3 py-2 rounded-lg transition"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
              Refresh
            </button>
            <button
              onClick={() => { sessionStorage.removeItem(ADMIN_TOKEN_KEY); setAuthed(false); }}
              className="flex items-center gap-1.5 bg-red-500/20 hover:bg-red-500/40 text-white text-sm px-3 py-2 rounded-lg transition"
            >
              <Lock size={14}/> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Action result banner */}
        {actionResult && (
          <div className={`mb-6 flex items-start gap-3 p-4 rounded-xl border ${
            actionResult.ok
              ? 'bg-green-50 border-green-300 text-green-800'
              : 'bg-red-50 border-red-300 text-red-800'
          }`}>
            {actionResult.ok ? <CheckCircle size={18} className="shrink-0 mt-0.5"/> : <AlertCircle size={18} className="shrink-0 mt-0.5"/>}
            <p className="text-sm font-medium flex-1">{actionResult.msg}</p>
            <button onClick={() => setActionResult(null)}><X size={16}/></button>
          </div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label:'Total Requests', value: stats.total,    icon:<BarChart3 size={24}/>,  color:'bg-blue-500',   sub: 'All time' },
            { label:'Pending',        value: stats.pending,  icon:<Clock     size={24}/>,  color:'bg-yellow-500', sub: 'Awaiting review' },
            { label:'Approved',       value: stats.approved, icon:<CheckCircle size={24}/>,color:'bg-green-500',  sub: 'Activated' },
            { label:'Rejected',       value: stats.rejected, icon:<XCircle   size={24}/>,  color:'bg-red-500',    sub: 'Not verified' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl shadow p-5 flex items-center gap-4">
              <div className={`${s.color} text-white rounded-xl p-3`}>{s.icon}</div>
              <div>
                <div className="text-2xl font-black text-gray-900">{s.value}</div>
                <div className="text-xs font-semibold text-gray-700">{s.label}</div>
                <div className="text-xs text-gray-400">{s.sub}</div>
              </div>
            </div>
          ))}
          {/* Total Revenue card */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow p-5 flex items-center gap-4 text-white">
            <div className="bg-white/20 rounded-xl p-3">
              <DollarSign size={24}/>
            </div>
            <div>
              <div className="text-2xl font-black">
                ${requests
                    .filter(r => r.status === 'approved')
                    .reduce((sum, r) => sum + r.amount, 0)
                    .toLocaleString()}
              </div>
              <div className="text-xs font-semibold text-emerald-100">Total Revenue</div>
              <div className="text-xs text-emerald-200">Approved only · USD</div>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="bg-white rounded-2xl shadow p-1 inline-flex mb-6">
          {(['pending','all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition ${
                filter === f
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f === 'pending' ? `⏳ Pending (${stats.pending})` : `📋 All Requests (${stats.total})`}
            </button>
          ))}
        </div>

        {/* Requests table */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          {loading ? (
            <div className="text-center py-16 text-gray-400">
              <RefreshCw size={32} className="animate-spin mx-auto mb-3 opacity-40"/>
              <p>Loading requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Clock size={40} className="mx-auto mb-3 opacity-30"/>
              <p className="font-medium">No {filter === 'pending' ? 'pending' : ''} requests</p>
              <p className="text-sm mt-1">All caught up! ✅</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['#','User','Plan','Amount','PayPal Sender','Status','Submitted','Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 font-mono">#{r.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{r.user.name}</div>
                        <div className="text-xs text-gray-500">{r.user.email}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                        {PLAN_LABEL[r.plan] ?? r.plan}
                      </td>
                      <td className="px-4 py-3 font-bold text-green-700">${r.amount}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{r.paypalEmail || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status}/></td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString('en-IN', { timeZone:'Asia/Kolkata', dateStyle:'medium', timeStyle:'short' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {/* View screenshot */}
                          <button
                            onClick={() => setViewReq(r)}
                            className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                            title="View screenshot"
                          >
                            <Eye size={14}/>
                          </button>

                          {r.status === 'pending' && (
                            <>
                              <button
                                onClick={() => { setActionReq(r); setActionType('approve'); setAdminNote(''); }}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition font-semibold"
                              >
                                <CheckCircle size={12}/> Approve
                              </button>
                              <button
                                onClick={() => { setActionReq(r); setActionType('reject'); setAdminNote(''); }}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition font-semibold"
                              >
                                <XCircle size={12}/> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* ── Total footer row ── */}
                {requests.length > 0 && (
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-sm font-bold text-gray-700">
                        Total ({requests.length} requests)
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-black text-emerald-700 text-base">
                          ${requests.reduce((sum, r) => sum + r.amount, 0).toLocaleString()} USD
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          ✅ Approved: <span className="font-bold text-green-600">
                            ${requests.filter(r => r.status === 'approved').reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
                          </span>
                          {' · '}
                          ⏳ Pending: <span className="font-bold text-yellow-600">
                            ${requests.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
                          </span>
                        </div>
                      </td>
                      <td colSpan={4} className="px-4 py-3 text-xs text-gray-400">
                        All amounts in USD
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── SCREENSHOT VIEW MODAL ─────────────────────────────────────────── */}
      {viewReq && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setViewReq(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-bold text-gray-900 text-lg">
                Payment Screenshot — #{viewReq.id}
              </h3>
              <button onClick={() => setViewReq(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={20}/>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['User',     viewReq.user.name],
                  ['Email',    viewReq.user.email],
                  ['Plan',     PLAN_LABEL[viewReq.plan] ?? viewReq.plan],
                  ['Amount',   `$${viewReq.amount} ${viewReq.currency}`],
                  ['PayPal',   viewReq.paypalEmail || '—'],
                  ['Status',   viewReq.status],
                ].map(([k,v]) => (
                  <div key={k} className="bg-gray-50 rounded-lg px-3 py-2">
                    <div className="text-xs text-gray-500">{k}</div>
                    <div className="font-semibold text-gray-800">{v}</div>
                  </div>
                ))}
              </div>

              {viewReq.transactionNote && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm">
                  <strong>Note:</strong> {viewReq.transactionNote}
                </div>
              )}

              {/* Screenshot */}
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
                <img
                  src={viewReq.screenshotUrl}
                  alt="Payment proof"
                  className="w-full object-contain max-h-96"
                  onError={e => {
                    (e.target as HTMLImageElement).src = '';
                    (e.target as HTMLImageElement).alt = 'Screenshot not found';
                  }}
                />
              </div>

              {/* Quick action buttons from modal */}
              {viewReq.status === 'pending' && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setViewReq(null); setActionReq(viewReq); setActionType('approve'); setAdminNote(''); }}
                    className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={16}/> Approve
                  </button>
                  <button
                    onClick={() => { setViewReq(null); setActionReq(viewReq); setActionType('reject'); setAdminNote(''); }}
                    className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl hover:bg-red-700 transition flex items-center justify-center gap-2"
                  >
                    <XCircle size={16}/> Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── APPROVE / REJECT CONFIRM MODAL ────────────────────────────────── */}
      {actionReq && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 ${
              actionType === 'approve' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {actionType === 'approve'
                ? <CheckCircle size={32} className="text-green-600"/>
                : <XCircle    size={32} className="text-red-600"/>}
            </div>

            <h3 className="text-xl font-bold text-gray-900 text-center mb-1">
              {actionType === 'approve' ? 'Approve Payment?' : 'Reject Payment?'}
            </h3>
            <p className="text-gray-500 text-sm text-center mb-5">
              Request <strong>#{actionReq.id}</strong> — <strong>{actionReq.user.name}</strong> ({actionReq.user.email})
              <br/>Plan: <strong>{PLAN_LABEL[actionReq.plan]}</strong>
            </p>

            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {actionType === 'approve'
                  ? 'Note to user (optional)'
                  : 'Reason for rejection '}
                {actionType === 'reject' && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                rows={3}
                placeholder={
                  actionType === 'approve'
                    ? 'e.g. Payment verified. Enjoy your subscription!'
                    : 'e.g. Screenshot is blurry. Please resend a clear PayPal confirmation.'
                }
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setActionReq(null); setAdminNote(''); }}
                className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={submitting || (actionType === 'reject' && !adminNote.trim())}
                className={`flex-1 text-white font-bold py-3 rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2 ${
                  actionType === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submitting ? (
                  <><RefreshCw size={16} className="animate-spin"/> Processing...</>
                ) : (
                  <><Send size={16}/> Confirm & Send Email</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
