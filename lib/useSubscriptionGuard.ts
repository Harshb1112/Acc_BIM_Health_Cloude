'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export type SubStatus = 'loading' | 'active' | 'trial' | 'expired' | 'none';

export interface SubInfo {
  status:      SubStatus;
  plan?:       string;
  endDate?:    Date;
  daysLeft?:   number;
  isTrial?:    boolean;
}

/**
 * useSubscriptionGuard
 * Reads subscription from localStorage and returns status.
 * If redirectOnExpire=true, pushes to /billing when expired/none.
 */
export function useSubscriptionGuard(redirectOnExpire = false): SubInfo {
  const router = useRouter();
  const [info, setInfo] = useState<SubInfo>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const setUnavailable = (status: 'expired' | 'none') => {
      localStorage.removeItem('subscription');
      if (cancelled) return;
      setInfo({ status });
      if (redirectOnExpire) router.replace('/billing');
    };

    const refreshSubscription = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setUnavailable('none');
        return;
      }

      try {
        const response = await fetch('/api/auth/subscription', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!response.ok) {
          setUnavailable('none');
          return;
        }

        const data = await response.json();
        const subscription = data.success ? data.subscription : null;
        if (!subscription) {
          setUnavailable('none');
          return;
        }

        const endDate = new Date(subscription.endDate);
        const daysLeft = Math.ceil((endDate.getTime() - Date.now()) / 86400000);
        if (!Number.isFinite(daysLeft) || daysLeft <= 0 || subscription.status !== 'active') {
          setUnavailable('expired');
          return;
        }

        localStorage.setItem('subscription', JSON.stringify(subscription));
        if (!cancelled) {
          setInfo({
            status: subscription.isTrial ? 'trial' : 'active',
            plan: subscription.plan,
            endDate,
            daysLeft,
            isTrial: subscription.isTrial,
          });
        }
      } catch {
        setUnavailable('none');
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshSubscription();
    };

    void refreshSubscription();
    window.addEventListener('focus', refreshWhenVisible);
    const interval = window.setInterval(refreshWhenVisible, 30_000);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', refreshWhenVisible);
      window.clearInterval(interval);
    };
  }, [redirectOnExpire, router]);

  return info;
}
