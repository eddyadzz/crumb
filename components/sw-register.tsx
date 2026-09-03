'use client';

import { useEffect } from 'react';

/** Registers the service worker in production builds only (dev HMR + SW
 * caching fight each other). Renders nothing. */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}