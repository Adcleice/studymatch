import { supabase } from './supabase.js';

const ATTRIBUTION_KEY = 'matchworking-campaign-attribution-v1';
const VISIT_KEY = 'matchworking-campaign-visit-v1';
const SESSION_KEY = 'matchworking-campaign-session-v1';

function safeStorage(storage, key, value) {
  try {
    if (value === undefined) return storage.getItem(key);
    storage.setItem(key, value);
  } catch {}
}

function readAttribution() {
  try {
    const raw = localStorage.getItem(ATTRIBUTION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getSessionId() {
  let id = safeStorage(sessionStorage, SESSION_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `mw-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    safeStorage(sessionStorage, SESSION_KEY, id);
  }
  return id;
}

export function getCampaignAttribution() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const source = params.get('utm_source');
  const content = params.get('utm_content');
  if (source && content) {
    const current = {
      source: source.slice(0, 100),
      medium: (params.get('utm_medium') || '').slice(0, 100),
      campaign: (params.get('utm_campaign') || '').slice(0, 100),
      content: content.slice(0, 100),
      captured_at: new Date().toISOString(),
    };
    // Keep the first campaign attribution for registration even after navigation.
    if (!readAttribution()) safeStorage(localStorage, ATTRIBUTION_KEY, JSON.stringify(current));
    return current;
  }
  return readAttribution();
}

export async function recordCampaignVisit() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const source = params.get('utm_source');
  const content = params.get('utm_content');
  if (!source || !content) return;

  const attribution = {
    source: source.slice(0, 100),
    medium: (params.get('utm_medium') || '').slice(0, 100),
    campaign: (params.get('utm_campaign') || '').slice(0, 100),
    content: content.slice(0, 100),
  };
  const sessionId = getSessionId();
  const dedupeKey = `${VISIT_KEY}:${sessionId}:${attribution.source}:${attribution.content}`;
  if (safeStorage(sessionStorage, dedupeKey)) return;
  // Mark before sending to avoid duplicate inserts during React StrictMode.
  safeStorage(sessionStorage, dedupeKey, '1');

  const { error } = await supabase.from('campaign_visits').insert({
    session_id: sessionId,
    ...attribution,
    landing_path: window.location.pathname.slice(0, 500),
  });
  if (error) {
    // Allow a retry if the first request failed.
    try { sessionStorage.removeItem(dedupeKey); } catch {}
  }
}
