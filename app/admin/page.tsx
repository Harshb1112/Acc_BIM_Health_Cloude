'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, CreditCard, Activity, BarChart3, DollarSign,
  CheckCircle, XCircle, Clock, RefreshCw, Lock,
  Search, ChevronLeft, ChevronRight, LogOut,
  UserCheck, UserX, TrendingUp, AlertCircle, X,
  Shield, Calendar, MapPin, Phone, Mail,
  Plus, Pencil, Trash2, Tag, ToggleLeft, ToggleRight
} from 'lucide-react';

const ADMIN_TOKEN_KEY = 'admin_token';
const PLAN_LABEL: Record<string, string> = {
  '1_month':   '1 Month — $10',
  '12_months': '1 Year — $100',
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface Overview {
  users:         { total: number; verified: number; unverified: number; newToday: number; newThisMonth: number };
  subscriptions: { total: number; active: number; trial: number };
  revenue:       { total: number; approvedCount: number };
  payments:      { pending: number; approved: number; rejected: number };
}

// ── helpers ───────────────────────────────────────────────────────────────────
function StatusPill({ v, t, f }: { v: string; t: string; f: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
      v === t ? 'bg-green-100 text-green-800' : v === f ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
    }`}>{v}</span>
  );
}
function Bool({ v }: { v: boolean }) {
  return v
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800"><CheckCircle size={10}/>Yes</span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600"><XCircle size={10}/>No</span>;
}
function dt(s: string) {
  return new Date(s).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}

// ── Pagination bar ─────────────────────────────────────────────────────────────
function Pager({ page, total, limit, onChange }: { page: number; total: number; limit: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
      <span>{(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
      <div className="flex gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={16}/></button>
        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
          const p = Math.max(1, Math.min(pages - 4, page - 2)) + i;
          return (
            <button key={p} onClick={() => onChange(p)}
              className={`w-8 h-8 rounded-lg text-xs font-semibold ${p === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}>
              {p}
            </button>
          );
        })}
        <button onClick={() => onChange(page + 1)} disabled={page === pages}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={16}/></button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed,    setAuthed]    = useState(false);
  const [tokenInput,setTokenInput]= useState('');
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState<'overview'|'users'|'subscriptions'|'payments'|'activities'|'plans'>('overview');
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState('');
  const [page,      setPage]      = useState(1);

  // data
  const [overview,   setOverview]   = useState<Overview | null>(null);
  const [recentActs, setRecentActs] = useState<any[]>([]);
  const [recentUsers,setRecentUsers]= useState<any[]>([]);
  const [expiring,   setExpiring]   = useState<any[]>([]);
  const [expired,    setExpired]    = useState<any[]>([]);
  const [rows,       setRows]       = useState<any[]>([]);
  const [total,      setTotal]      = useState(0);

  // plans state
  const [adminPlans,    setAdminPlans]    = useState<any[]>([]);
  const [plansLoading,  setPlansLoading]  = useState(false);
  const [planResult,    setPlanResult]    = useState<{ok:boolean;msg:string}|null>(null);
  const [editPlan,      setEditPlan]      = useState<any|null>(null);   // null=closed, {}=new, plan=edit
  const [planForm,      setPlanForm]      = useState({ name:'', planId:'', duration:'', price:'', currency:'USD', description:'', isActive:true, isPopular:false, sortOrder:'0' });

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = sessionStorage.getItem(ADMIN_TOKEN_KEY);
    if (t) setAuthed(true);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/dashboard?section=overview', {
      headers: { 'x-admin-token': tokenInput },
    });
    if (res.ok) { sessionStorage.setItem(ADMIN_TOKEN_KEY, tokenInput); setAuthed(true); setAuthError(''); }
    else setAuthError('Wrong admin token.');
  };

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const token = () => sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    const res  = await fetch('/api/admin/dashboard?section=overview', { headers: { 'x-admin-token': token() } });
    const data = await res.json();
    if (data.success) {
      setOverview(data.overview);
      setRecentActs(data.recentActivities);
      setRecentUsers(data.recentUsers);
      setExpiring(data.expiringSoon || []);
      setExpired(data.expiredSubs || []);
    }
    setLoading(false);
  }, []);

  const fetchSection = useCallback(async () => {
    if (tab === 'overview') { fetchOverview(); return; }
    if (tab === 'plans')    { fetchPlans();    return; }
    setLoading(true);
    const url = `/api/admin/dashboard?section=${tab}&page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`;
    const res  = await fetch(url, { headers: { 'x-admin-token': token() } });
    const data = await res.json();
    if (data.success) {
      setRows(data.users || data.subscriptions || data.payments || data.activities || []);
      setTotal(data.total || 0);
    }
    setLoading(false);
  }, [tab, page, search, fetchOverview]);

  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    const res  = await fetch('/api/admin/plans', { headers: { 'x-admin-token': token() } });
    const data = await res.json();
    if (data.success) setAdminPlans(data.plans);
    setPlansLoading(false);
  }, []);

  useEffect(() => { if (authed) fetchSection(); }, [authed, fetchSection]);
  useEffect(() => { setPage(1); setRows([]); }, [tab, search]);

  // ── Plan CRUD ────────────────────────────────────────────────────────────────
  const openNewPlan = () => {
    setPlanForm({ name:'', planId:'', duration:'', price:'', currency:'USD', description:'', isActive:true, isPopular:false, sortOrder:'0' });
    setEditPlan({});
  };
  const openEditPlan = (p: any) => {
    setPlanForm({ name:p.name, planId:p.planId, duration:String(p.duration), price:String(p.price), currency:p.currency||'USD', description:p.description||'', isActive:p.isActive, isPopular:p.isPopular, sortOrder:String(p.sortOrder||0) });
    setEditPlan(p);
  };
  const savePlan = async () => {
    const isNew = !editPlan?.id;
    const res = await fetch('/api/admin/plans', {
      method:  isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type':'application/json', 'x-admin-token': token() },
      body: JSON.stringify({ ...planForm, ...(isNew ? {} : { id: editPlan.id }), duration: Number(planForm.duration), price: Number(planForm.price), sortOrder: Number(planForm.sortOrder) }),
    });
    const data = await res.json();
    setPlanResult({ ok: data.success, msg: data.message || data.error });
    if (data.success) { setEditPlan(null); fetchPlans(); }
  };
  const deletePlan = async (id: number, name: string) => {
    if (!confirm(`Delete plan "${name}"? This cannot be undone.`)) return;
    const res  = await fetch(`/api/admin/plans?id=${id}`, { method:'DELETE', headers:{ 'x-admin-token': token() } });
    const data = await res.json();
    setPlanResult({ ok: data.success, msg: data.message || data.error });
    if (data.success) fetchPlans();
  };
  const togglePlan = async (p: any) => {
    const res  = await fetch('/api/admin/plans', { method:'PUT', headers:{'Content-Type':'application/json','x-admin-token':token()}, body: JSON.stringify({ id:p.id, isActive:!p.isActive }) });
    const data = await res.json();
    if (data.success) fetchPlans();
  };

  // ── Subscription cancel/delete ─────────────────────────────────────────────
  const [subResult, setSubResult] = useState<{ok:boolean;msg:string}|null>(null);

  const handleSubAction = async (id: number, action: 'cancel'|'delete', email: string) => {
    const msg = action === 'delete'
      ? `Delete subscription for ${email}? This cannot be undone.`
      : `Cancel subscription for ${email}?`;
    if (!confirm(msg)) return;

    const res  = await fetch(`/api/admin/subscriptions?id=${id}&action=${action}`, {
      method:  'DELETE',
      headers: { 'x-admin-token': token() },
    });
    const data = await res.json();
    setSubResult({ ok: data.success, msg: data.message || data.error });
    if (data.success) fetchSection();
  };

  // ── User delete ────────────────────────────────────────────────────────────
  const [userResult, setUserResult] = useState<{ok:boolean;msg:string}|null>(null);

  const handleDeleteUser = async (id: number, name: string, email: string) => {
    if (!confirm(`DELETE user "${name}" (${email})?\n\nThis will permanently delete:\n• User account\n• All subscriptions\n• All payment requests\n• All activity logs\n• All sessions\n\nThis CANNOT be undone!`)) return;
    const res  = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE', headers: { 'x-admin-token': token() } });
    const data = await res.json();
    setUserResult({ ok: data.success, msg: data.message || data.error });
    if (data.success) fetchSection();
  };

  // ── Payment delete ──────────────────────────────────────────────────────────
  const [payResult, setPayResult] = useState<{ok:boolean;msg:string}|null>(null);

  const handleDeletePayment = async (id: number) => {
    if (!confirm(`Delete payment request #${id}? This cannot be undone.`)) return;
    const res  = await fetch(`/api/admin/payments/delete?id=${id}`, { method: 'DELETE', headers: { 'x-admin-token': token() } });
    const data = await res.json();
    setPayResult({ ok: data.success, msg: data.message || data.error });
    if (data.success) fetchSection();
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // LOGIN GATE
  if (!authed) return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Lock size={32} className="text-white"/>
          </div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-gray-500 text-sm">BIM Health Report</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="password" value={tokenInput} onChange={e => setTokenInput(e.target.value)}
            placeholder="Enter ADMIN_SECRET_TOKEN"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" required/>
          {authError && <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{authError}</p>}
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition">Login</button>
        </form>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // TABS config
  const TABS = [
    { id: 'overview',      label: 'Overview',      icon: <BarChart3 size={16}/> },
    { id: 'users',         label: 'Users',         icon: <Users     size={16}/> },
    { id: 'subscriptions', label: 'Subscriptions', icon: <CreditCard size={16}/> },
    { id: 'payments',      label: 'Payments',      icon: <DollarSign size={16}/> },
    { id: 'activities',    label: 'Activity Log',  icon: <Activity   size={16}/> },
    { id: 'plans',         label: 'Plans',         icon: <Tag        size={16}/> },
  ] as const;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100">

      {/* ── HEADER ── */}
      <header className="bg-gradient-to-r from-gray-900 to-blue-900 text-white shadow-xl sticky top-0 z-30">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">🏗️ BIM Health Report — Admin</h1>
            <p className="text-blue-200 text-xs">Full Database Management</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin/payments" className="text-xs bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-200 px-3 py-1.5 rounded-lg">
              ⏳ Pending Payments
            </a>
            <button onClick={fetchSection} className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''}/> Refresh
            </button>
            <button onClick={() => { sessionStorage.removeItem(ADMIN_TOKEN_KEY); setAuthed(false); }}
              className="flex items-center gap-1 bg-red-500/20 hover:bg-red-500/40 text-white text-xs px-3 py-1.5 rounded-lg">
              <LogOut size={13}/> Logout
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-screen-xl mx-auto px-6 flex gap-1 pb-2 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-t-lg text-sm font-medium whitespace-nowrap transition ${
                tab === t.id ? 'bg-white text-blue-700' : 'text-blue-200 hover:bg-white/10'
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-6 py-6">

        {/* ─────────────────── OVERVIEW ──────────────────────────── */}
        {tab === 'overview' && overview && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label:'Total Users',     value: overview.users.total,           icon:<Users      size={22}/>, color:'bg-blue-500',   sub:`${overview.users.newToday} today` },
                { label:'Active Subs',     value: overview.subscriptions.active,  icon:<CreditCard size={22}/>, color:'bg-purple-500', sub:`${overview.subscriptions.trial} on trial` },
                { label:'Total Revenue',   value:`$${overview.revenue.total}`,    icon:<DollarSign size={22}/>, color:'bg-emerald-500',sub:`${overview.revenue.approvedCount} payments` },
                { label:'Expiring Soon',   value:(overview.subscriptions as any).expiringSoon ?? 0, icon:<Clock size={22}/>, color:'bg-yellow-500', sub:'Within 7 days' },
                { label:'Pending Pay.',    value: overview.payments.pending,      icon:<AlertCircle size={22}/>, color:'bg-red-500', sub:'Needs review' },
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
            </div>

            {/* Secondary stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label:'Verified Users',   value: overview.users.verified,            color:'text-green-600' },
                { label:'Unverified',        value: overview.users.unverified,          color:'text-red-500'   },
                { label:'New This Month',    value: overview.users.newThisMonth,        color:'text-blue-600'  },
                { label:'Approved Payments', value: overview.payments.approved,         color:'text-emerald-600'},
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl shadow p-4 text-center">
                  <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Users */}
              <div className="bg-white rounded-2xl shadow overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2"><Users size={16} className="text-blue-500"/>Recent Registrations</h3>
                  <button onClick={() => setTab('users')} className="text-xs text-blue-600 hover:underline">View all →</button>
                </div>
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-4 py-2 text-left text-xs text-gray-500 uppercase">User</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-500 uppercase">Verified</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-500 uppercase">Joined</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentUsers.map((u: any) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-gray-900 text-xs">{u.name}</div>
                          <div className="text-gray-400 text-xs">{u.email}</div>
                        </td>
                        <td className="px-4 py-2.5"><Bool v={u.isVerified}/></td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-2xl shadow overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2"><Activity size={16} className="text-purple-500"/>Recent Activity</h3>
                  <button onClick={() => setTab('activities')} className="text-xs text-blue-600 hover:underline">View all →</button>
                </div>
                <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {recentActs.map((a: any) => (
                    <div key={a.id} className="px-4 py-2.5 hover:bg-gray-50">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="inline-block bg-blue-100 text-blue-700 text-xs font-mono px-1.5 py-0.5 rounded mr-2">{a.activityType}</span>
                          <span className="text-xs text-gray-500">{a.user?.email}</span>
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{new Date(a.timestamp).toLocaleDateString()}</span>
                      </div>
                      {a.details && <p className="text-xs text-gray-400 mt-0.5 truncate">{a.details}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── EXPIRING SOON ── */}
            {expiring.length > 0 && (
              <div className="bg-white rounded-2xl shadow overflow-hidden border-l-4 border-yellow-400">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <Clock size={16} className="text-yellow-500"/>
                  <h3 className="font-bold text-yellow-800">⚠️ Expiring Within 7 Days ({expiring.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-yellow-50"><tr>
                      {['User','Email','Plan','Expires On','Days Left'].map(h=>(
                        <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-yellow-700 uppercase">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-yellow-50">
                      {expiring.map((s:any) => {
                        const daysLeft = Math.ceil((new Date(s.endDate).getTime() - Date.now()) / (1000*60*60*24));
                        return (
                          <tr key={s.id} className="hover:bg-yellow-50">
                            <td className="px-4 py-2.5 font-semibold text-gray-900 text-xs">{s.user?.name}</td>
                            <td className="px-4 py-2.5 text-gray-500 text-xs">{s.user?.email}</td>
                            <td className="px-4 py-2.5 text-xs">{PLAN_LABEL[s.plan]??s.plan}</td>
                            <td className="px-4 py-2.5 text-xs text-gray-600">{new Date(s.endDate).toLocaleDateString()}</td>
                            <td className="px-4 py-2.5">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${daysLeft<=1?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700'}`}>
                                {daysLeft}d left
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── EXPIRED (not yet cancelled) ── */}
            {expired.length > 0 && (
              <div className="bg-white rounded-2xl shadow overflow-hidden border-l-4 border-red-400">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                  <XCircle size={16} className="text-red-500"/>
                  <h3 className="font-bold text-red-800">🔴 Expired Subscriptions ({expired.length}) — Access Blocked</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-red-50"><tr>
                      {['User','Email','Plan','Expired On','Days Ago'].map(h=>(
                        <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-red-700 uppercase">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-red-50">
                      {expired.map((s:any) => {
                        const daysAgo = Math.floor((Date.now() - new Date(s.endDate).getTime()) / (1000*60*60*24));
                        return (
                          <tr key={s.id} className="hover:bg-red-50">
                            <td className="px-4 py-2.5 font-semibold text-gray-900 text-xs">{s.user?.name}</td>
                            <td className="px-4 py-2.5 text-gray-500 text-xs">{s.user?.email}</td>
                            <td className="px-4 py-2.5 text-xs">{PLAN_LABEL[s.plan]??s.plan}</td>
                            <td className="px-4 py-2.5 text-xs text-red-600 font-medium">{new Date(s.endDate).toLocaleDateString()}</td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                {daysAgo}d ago
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────── USERS ────────────────────────────── */}
        {tab === 'users' && (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Users size={16} className="text-blue-500"/>All Users <span className="text-gray-400 font-normal text-sm">({total})</span></h3>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email..."
                  className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"/>
              </div>
            </div>
            {userResult && (
              <div className={`mx-5 mt-4 flex items-center gap-3 p-3 rounded-xl border text-sm ${userResult.ok ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
                {userResult.ok ? <CheckCircle size={15}/> : <AlertCircle size={15}/>}
                <span className="flex-1">{userResult.msg}</span>
                <button onClick={() => setUserResult(null)}><X size={14}/></button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  {['#','Name','Email','Phone','Region','Verified','Plan','Joined','Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((u: any) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{u.id}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{u.name}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{u.email}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{u.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{u.region || '—'}</td>
                      <td className="px-4 py-3"><Bool v={u.isVerified}/></td>
                      <td className="px-4 py-3 text-xs">
                        {u.subscriptions?.[0]
                          ? <span className={`px-2 py-0.5 rounded-full font-semibold ${u.subscriptions[0].isTrial ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                              {u.subscriptions[0].isTrial ? 'Trial' : PLAN_LABEL[u.subscriptions[0].plan] ?? u.subscriptions[0].plan}
                            </span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteUser(u.id, u.name, u.email)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition"
                        >
                          <Trash2 size={12}/> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} total={total} limit={20} onChange={p => setPage(p)}/>
          </div>
        )}

        {/* ─────────────────── SUBSCRIPTIONS ───────────────────── */}
        {tab === 'subscriptions' && (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><CreditCard size={16} className="text-purple-500"/>All Subscriptions <span className="text-gray-400 font-normal text-sm">({total})</span></h3>
            </div>
            {subResult && (
              <div className={`mx-5 mt-4 flex items-center gap-3 p-3 rounded-xl border text-sm ${subResult.ok ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
                {subResult.ok ? <CheckCircle size={15}/> : <AlertCircle size={15}/>}
                <span className="flex-1">{subResult.msg}</span>
                <button onClick={() => setSubResult(null)}><X size={14}/></button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  {['#','User','Email','Plan','Status','Trial','Amount','Start','End','Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((s: any) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{s.id}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900 text-xs">{s.user?.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{s.user?.email}</td>
                      <td className="px-4 py-3 text-xs font-medium">{PLAN_LABEL[s.plan] ?? s.plan}</td>
                      <td className="px-4 py-3"><StatusPill v={s.status} t="active" f="cancelled"/></td>
                      <td className="px-4 py-3"><Bool v={s.isTrial}/></td>
                      <td className="px-4 py-3 text-xs font-bold text-emerald-700">{s.amount ? `$${s.amount}` : '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(s.startDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(s.endDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {s.status === 'active' && (
                            <button
                              onClick={() => handleSubAction(s.id, 'cancel', s.user?.email)}
                              className="flex items-center gap-1 px-2 py-1 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-lg transition"
                            >
                              <XCircle size={11}/> Cancel
                            </button>
                          )}
                          <button
                            onClick={() => handleSubAction(s.id, 'delete', s.user?.email)}
                            className="flex items-center gap-1 px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition"
                          >
                            <Trash2 size={11}/> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {rows.length > 0 && (
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-sm font-bold text-gray-700">Total Revenue</td>
                      <td className="px-4 py-3 text-base font-black text-emerald-700">
                        ${rows.filter((s:any)=>s.status==='active'&&!s.isTrial).reduce((sum:number,s:any)=>sum+(s.amount||0),0).toFixed(0)}
                      </td>
                      <td colSpan={2}/>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <Pager page={page} total={total} limit={20} onChange={p => setPage(p)}/>
          </div>
        )}

        {/* ─────────────────── PAYMENTS ────────────────────────── */}
        {tab === 'payments' && (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><DollarSign size={16} className="text-emerald-500"/>All Payment Requests <span className="text-gray-400 font-normal text-sm">({total})</span></h3>
              <a href="/admin/payments" className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
                Open Payment Manager →
              </a>
            </div>
            {payResult && (
              <div className={`mx-5 mt-4 flex items-center gap-3 p-3 rounded-xl border text-sm ${payResult.ok ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
                {payResult.ok ? <CheckCircle size={15}/> : <AlertCircle size={15}/>}
                <span className="flex-1">{payResult.msg}</span>
                <button onClick={() => setPayResult(null)}><X size={14}/></button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  {['#','User','Email','Plan','Amount','PayPal','Status','Note','Date','Action'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{p.id}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900 text-xs">{p.user?.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.user?.email}</td>
                      <td className="px-4 py-3 text-xs">{PLAN_LABEL[p.plan] ?? p.plan}</td>
                      <td className="px-4 py-3 font-bold text-emerald-700 text-xs">${p.amount}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{p.paypalEmail || '—'}</td>
                      <td className="px-4 py-3">
                        {p.status==='approved' && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">✅ Approved</span>}
                        {p.status==='pending'  && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">⏳ Pending</span>}
                        {p.status==='rejected' && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">❌ Rejected</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">{p.adminNote || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-lg transition"
                        >
                          <Trash2 size={12}/> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {rows.length > 0 && (
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-700">Total ({rows.length})</td>
                      <td className="px-4 py-3 font-black text-emerald-700">
                        ${rows.reduce((s:number,p:any)=>s+p.amount,0)} USD
                        <div className="text-xs font-normal text-gray-400">
                          ✅${rows.filter((p:any)=>p.status==='approved').reduce((s:number,p:any)=>s+p.amount,0)} approved
                        </div>
                      </td>
                      <td colSpan={4}/>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <Pager page={page} total={total} limit={20} onChange={p => setPage(p)}/>
          </div>
        )}

        {/* ─────────────────── ACTIVITY LOG ────────────────────── */}
        {tab === 'activities' && (
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Activity size={16} className="text-indigo-500"/>Activity Log <span className="text-gray-400 font-normal text-sm">({total})</span></h3>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search type or email..."
                  className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-300"/>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  {['#','User','Email','Action','Details','IP','Time'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((a: any) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{a.id}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900 text-xs">{a.user?.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{a.user?.email}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block bg-indigo-100 text-indigo-700 text-xs font-mono px-2 py-0.5 rounded">{a.activityType}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{a.details || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{a.ipAddress || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{dt(a.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} total={total} limit={20} onChange={p => setPage(p)}/>
          </div>
        )}

        {/* ─────────────────── PLANS ───────────────────────────── */}
        {tab === 'plans' && (
          <div className="space-y-4">

            {/* Result banner */}
            {planResult && (
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${planResult.ok ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
                {planResult.ok ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
                <span className="text-sm font-medium flex-1">{planResult.msg}</span>
                <button onClick={() => setPlanResult(null)}><X size={14}/></button>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-lg"><Tag size={18} className="text-blue-500"/>Subscription Plans ({adminPlans.length})</h3>
              <button onClick={openNewPlan} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl transition text-sm">
                <Plus size={16}/> Add New Plan
              </button>
            </div>

            {/* Plans cards */}
            {plansLoading ? (
              <div className="flex items-center justify-center py-16"><RefreshCw size={24} className="animate-spin text-blue-500"/></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {adminPlans.map(p => (
                  <div key={p.id} className={`bg-white rounded-2xl shadow border-2 p-5 ${p.isActive ? 'border-gray-200' : 'border-dashed border-gray-300 opacity-60'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900 text-lg">{p.name}</h4>
                          {p.isPopular && <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">⭐ Popular</span>}
                          {!p.isActive && <span className="bg-gray-100 text-gray-500 text-xs font-bold px-2 py-0.5 rounded-full">Inactive</span>}
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{p.planId}</p>
                      </div>
                      <div className="text-2xl font-black text-blue-600">${p.price}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                      <div className="bg-gray-50 rounded-lg px-3 py-1.5"><span className="text-gray-400">Duration</span><div className="font-semibold">{p.duration} days</div></div>
                      <div className="bg-gray-50 rounded-lg px-3 py-1.5"><span className="text-gray-400">Currency</span><div className="font-semibold">{p.currency}</div></div>
                      <div className="bg-gray-50 rounded-lg px-3 py-1.5"><span className="text-gray-400">Sort Order</span><div className="font-semibold">{p.sortOrder}</div></div>
                      <div className="bg-gray-50 rounded-lg px-3 py-1.5"><span className="text-gray-400">Status</span><div className={`font-semibold ${p.isActive ? 'text-green-600' : 'text-gray-400'}`}>{p.isActive ? 'Active' : 'Inactive'}</div></div>
                    </div>

                    {p.description && <p className="text-xs text-gray-500 italic mb-3">{p.description}</p>}

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button onClick={() => openEditPlan(p)} className="flex-1 flex items-center justify-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2 rounded-lg text-xs transition">
                        <Pencil size={12}/> Edit
                      </button>
                      <button onClick={() => togglePlan(p)} className={`flex-1 flex items-center justify-center gap-1 font-semibold py-2 rounded-lg text-xs transition ${p.isActive ? 'bg-yellow-50 hover:bg-yellow-100 text-yellow-700' : 'bg-green-50 hover:bg-green-100 text-green-700'}`}>
                        {p.isActive ? <><ToggleLeft size={12}/> Deactivate</> : <><ToggleRight size={12}/> Activate</>}
                      </button>
                      <button onClick={() => deletePlan(p.id, p.name)} className="flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2 px-3 rounded-lg text-xs transition">
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  </div>
                ))}

                {adminPlans.length === 0 && (
                  <div className="col-span-3 text-center py-16 text-gray-400">
                    <Tag size={40} className="mx-auto mb-3 opacity-30"/>
                    <p>No plans yet. Click "Add New Plan" to create one.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── ADD/EDIT PLAN MODAL ─────────────────────────────── */}
        {editPlan !== null && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-gray-900 text-lg">{editPlan.id ? '✏️ Edit Plan' : '➕ New Plan'}</h3>
                <button onClick={() => setEditPlan(null)}><X size={20}/></button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Plan Name *</label>
                    <input value={planForm.name} onChange={e => setPlanForm(f=>({...f, name:e.target.value}))} placeholder="e.g. 1 Month" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Plan ID * <span className="text-gray-400">(unique)</span></label>
                    <input value={planForm.planId} onChange={e => setPlanForm(f=>({...f, planId:e.target.value.toLowerCase().replace(/\s/g,'_')}))} placeholder="e.g. 1_month" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400" disabled={!!editPlan.id}/>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Price *</label>
                    <input type="number" min="0" value={planForm.price} onChange={e => setPlanForm(f=>({...f, price:e.target.value}))} placeholder="10" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Duration (days) *</label>
                    <input type="number" min="1" value={planForm.duration} onChange={e => setPlanForm(f=>({...f, duration:e.target.value}))} placeholder="30" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Currency</label>
                    <select value={planForm.currency} onChange={e => setPlanForm(f=>({...f, currency:e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                      <option>USD</option><option>INR</option><option>EUR</option><option>GBP</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Description</label>
                  <input value={planForm.description} onChange={e => setPlanForm(f=>({...f, description:e.target.value}))} placeholder="e.g. Best value for teams" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Sort Order</label>
                    <input type="number" min="0" value={planForm.sortOrder} onChange={e => setPlanForm(f=>({...f, sortOrder:e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={planForm.isActive} onChange={e => setPlanForm(f=>({...f, isActive:e.target.checked}))} className="w-4 h-4 accent-blue-600"/>
                      <span className="text-sm font-medium text-gray-700">Active</span>
                    </label>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={planForm.isPopular} onChange={e => setPlanForm(f=>({...f, isPopular:e.target.checked}))} className="w-4 h-4 accent-purple-600"/>
                      <span className="text-sm font-medium text-gray-700">Popular</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setEditPlan(null)} className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">Cancel</button>
                <button onClick={savePlan} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-2">
                  <CheckCircle size={15}/> {editPlan.id ? 'Update Plan' : 'Create Plan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white rounded-xl shadow-xl px-6 py-4 flex items-center gap-3">
              <RefreshCw size={20} className="animate-spin text-blue-600"/>
              <span className="text-sm font-medium text-gray-700">Loading...</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
