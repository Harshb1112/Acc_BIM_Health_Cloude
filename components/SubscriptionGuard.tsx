'use client';

import Link from 'next/link';
import { AlertTriangle, CreditCard, Clock } from 'lucide-react';
import { SubInfo } from '@/lib/useSubscriptionGuard';

interface Props {
  sub:      SubInfo;
  children: React.ReactNode;
}

/**
 * Wraps any page — shows expired screen if subscription is gone.
 * Shows warning banner if <= 5 days left.
 */
export default function SubscriptionGuard({ sub, children }: Props) {

  // ── Still loading ─────────────────────────────────────────────────────
  if (sub.status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"/>
      </div>
    );
  }

  // ── No subscription / Expired ─────────────────────────────────────────
  if (sub.status === 'expired' || sub.status === 'none') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center border border-red-100">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertTriangle size={40} className="text-red-500"/>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {sub.status === 'expired' ? 'Subscription Expired' : 'No Active Subscription'}
          </h2>
          <p className="text-gray-500 mb-2">
            {sub.status === 'expired'
              ? `Your subscription ended on ${sub.endDate?.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}.`
              : 'You need an active subscription to use this feature.'}
          </p>
          <p className="text-gray-500 mb-6 text-sm">
            Subscribe now to continue using BIM Health Report.
          </p>
          <Link
            href="/billing"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold px-8 py-3 rounded-xl hover:opacity-90 transition"
          >
            <CreditCard size={18}/> View Plans & Subscribe
          </Link>
          <p className="text-xs text-gray-400 mt-4">
            Already paid? Your account will be activated within 24 hours after admin review.
          </p>
        </div>
      </div>
    );
  }

  // ── Active with warning banner ─────────────────────────────────────────
  return (
    <>
      {/* Warning banner — show if <= 5 days left */}
      {sub.daysLeft !== undefined && sub.daysLeft <= 5 && (
        <div className={`mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${
          sub.daysLeft <= 1
            ? 'bg-red-50 border-red-300 text-red-800'
            : 'bg-yellow-50 border-yellow-300 text-yellow-800'
        }`}>
          <Clock size={16} className="shrink-0"/>
          <span>
            {sub.isTrial ? '🎁 Trial' : '📦 Subscription'} expires in{' '}
            <strong>{sub.daysLeft} day{sub.daysLeft !== 1 ? 's' : ''}</strong>!
            {' '}
          </span>
          <Link href="/billing" className="ml-auto underline font-bold whitespace-nowrap">
            Renew Now →
          </Link>
        </div>
      )}
      {children}
    </>
  );
}
