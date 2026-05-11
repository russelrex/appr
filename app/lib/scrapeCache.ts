/**
 * In-memory server-side cache for Skool member scrapes (same Node process).
 * TTL: 30 minutes per tab.
 */

import type { SkoolMember } from "./skoolMember";

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry {
  members: SkoolMember[];
  totalPages: number;
  cachedAt: number;
  tab: string;
}

const store = new Map<string, CacheEntry>();

export const scrapeCache = {
  get(tab: string): CacheEntry | null {
    const entry = store.get(tab);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      store.delete(tab);
      return null;
    }
    return entry;
  },

  set(tab: string, members: SkoolMember[], totalPages: number) {
    store.set(tab, { members, totalPages, cachedAt: Date.now(), tab });
  },

  invalidate(tab?: string) {
    if (tab) store.delete(tab);
    else store.clear();
  },

  status(): Record<string, { count: number; cachedAt: number; ageSeconds: number; expiresInSeconds: number }> {
    const out: Record<string, { count: number; cachedAt: number; ageSeconds: number; expiresInSeconds: number }> = {};
    const now = Date.now();
    for (const [tab, entry] of store.entries()) {
      const age = now - entry.cachedAt;
      if (age > CACHE_TTL_MS) {
        store.delete(tab);
        continue;
      }
      out[tab] = {
        count: entry.members.length,
        cachedAt: entry.cachedAt,
        ageSeconds: Math.floor(age / 1000),
        expiresInSeconds: Math.floor((CACHE_TTL_MS - age) / 1000),
      };
    }
    return out;
  },
};
