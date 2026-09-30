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
    const raw = localStorage.getItem('subscription');

    if (!raw) {
      setInfo({ status: 'none' });
      if (redirectOnExpire) router.push('/billing');
      return;
    }

    try {
      const sub     = JSON.parse(raw);
      const endDate = new Date(sub.endDate);
      const now     = new Date();
      const diffMs  = endDate.getTime() - now.getTime();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (daysLeft <= 0 || sub.status !== 'active') {
        setInfo({ status: 'expired', endDate, daysLeft: 0, plan: sub.plan });
        if (redirectOnExpire) router.push('/billing');
        return;
      }

      setInfo({
        status:   sub.isTrial ? 'trial' : 'active',
        plan:     sub.plan,
        endDate,
        daysLeft,
        isTrial:  sub.isTrial,
      });
    } catch {
      setInfo({ status: 'none' });
      if (redirectOnExpire) router.push('/billing');
    }
  }, [redirectOnExpire, router]);

  return info;
}
