import { useState, useEffect } from 'react';

export type Route =
  | { name: 'dashboard' }
  | { name: 'icp-configs' }
  | { name: 'review-queue' }
  | { name: 'lead-detail'; leadId: string }
  | { name: 'settings' };

function parseHash(): Route {
  const hash = window.location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);

  if (parts.length === 0) return { name: 'dashboard' };
  if (parts[0] === 'dashboard') return { name: 'dashboard' };
  if (parts[0] === 'icp-configs') return { name: 'icp-configs' };
  if (parts[0] === 'review-queue') return { name: 'review-queue' };
  if (parts[0] === 'leads' && parts[1]) return { name: 'lead-detail', leadId: parts[1] };
  if (parts[0] === 'settings') return { name: 'settings' };

  return { name: 'dashboard' };
}

export function navigate(route: Route) {
  let hash = '#/';
  switch (route.name) {
    case 'dashboard': hash = '#/dashboard'; break;
    case 'icp-configs': hash = '#/icp-configs'; break;
    case 'review-queue': hash = '#/review-queue'; break;
    case 'lead-detail': hash = `#/leads/${route.leadId}`; break;
    case 'settings': hash = '#/settings'; break;
  }
  window.location.hash = hash;
}

export function useRouter() {
  const [route, setRoute] = useState<Route>(parseHash());

  useEffect(() => {
    const handler = () => setRoute(parseHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return route;
}
