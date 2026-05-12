"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { Icons } from "@/components/ui/icons";

interface SkoolMember {
  id: string; name: string; handle: string; bio: string; avatar: string;
  tier: string; activeAgo: string; joinedDate: string; location: string;
  price: string; renewsIn: string; status: "active" | "cancelling" | "cancelled";
  cancelledInfo?: string; referralSource: string; referralIcon: string; level: number;
}

type Tab = "active" | "cancelling" | "churned" | "banned";
const TABS: { key: Tab; label: string }[] = [
  { key: "active",     label: "Active"     },
  { key: "cancelling", label: "Cancelling" },
  { key: "churned",    label: "Churned"    },
  { key: "banned",     label: "Banned"     },
];

const REFERRAL_OPTIONS = ["", "Google", "Instagram", "YouTube", "Facebook", "Twitter"];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

/* ── Price tiers ──────────────────────────────────────────────────────── */
const PRICE_TIERS: { key: string; label: string; sub: string; amounts: number[]; color: string }[] = [
  { key: "",     label: "All plans",   sub: "",           amounts: [],          color: "" },
  { key: "free", label: "Free",        sub: "Lifetime",   amounts: [0],         color: "emerald" },
  { key: "19",   label: "$19 / mo",    sub: "",           amounts: [19],        color: "sky" },
  { key: "29",   label: "$29 / mo",    sub: "",           amounts: [29],        color: "cyan" },
  { key: "33",   label: "$33 / mo",    sub: "",           amounts: [33],        color: "teal" },
  { key: "34",   label: "$34 / mo",    sub: "",           amounts: [34],        color: "indigo" },
  { key: "35",   label: "$35 / mo",    sub: "Basic",      amounts: [35, 36],    color: "violet" },
  { key: "49",   label: "$49 / mo",    sub: "",           amounts: [49],        color: "purple" },
  { key: "annual", label: "$330–$340", sub: "Annual",     amounts: [330, 340],  color: "amber" },
];

function MemberRow({ member, index }: { member: SkoolMember; index: number }) {
  const isCancelled = member.status === "cancelled" || !!member.cancelledInfo;
  const colorIdx = Math.abs(
    member.name.split("").reduce((h, c) => c.charCodeAt(0) + ((h << 5) - h), 0)
  ) % 7;
  const initials = getInitials(member.name);
  const num = parseFloat((member.price || "").replace(/[^0-9.]/g, "")) || 0;
  const planKind = isCancelled
    ? "cancelled"
    : !member.price || member.price === "Free"
      ? "free"
      : num >= 300 || (member.renewsIn || "").toLowerCase().includes("year")
        ? "annual"
        : num === 35 || num === 36
          ? "basic"
          : "paid";

  return (
    <div className="member" data-selected={index === 0 ? "true" : undefined}>
      <div className="avatar" data-color={String(colorIdx)}>
        {member.avatar ? (
          <img
            src={member.avatar}
            alt={member.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
          />
        ) : (
          initials
        )}
        <span className="avatar-badge">{member.level || 1}</span>
      </div>

      <div className="member-body">
        <div className="member-name">
          <h4>{member.name}</h4>
          {member.handle && <span className="handle">{member.handle}</span>}
          {member.tier && (
            <span className="tag" data-kind="basic">
              {member.tier}
            </span>
          )}
          {member.price && (
            <span className="tag" data-kind={planKind as "free" | "paid" | "annual" | "basic" | "cancelled"}>
              {member.price === "Free" ? "Free" : member.price}
            </span>
          )}
        </div>
        {member.bio && <div className="bio">{member.bio}</div>}
        <div className="tagrow">
          {member.activeAgo && (
            <span>
              <Icons.Clock size={12} /> Active <b>{member.activeAgo}</b>
            </span>
          )}
          {member.renewsIn && !isCancelled && (
            <span>
              <Icons.Refresh size={12} /> <b>{member.renewsIn}</b>
            </span>
          )}
          {isCancelled && member.cancelledInfo && (
            <span style={{ color: "var(--neg)" }}>
              <b>{member.cancelledInfo}</b>
            </span>
          )}
          {member.referralSource && (
            <span className="source-pill">
              via <b>{member.referralSource}</b>
            </span>
          )}
        </div>
      </div>

      <div className="member-rt">
        {member.joinedDate && (
          <div className="joined">
            Joined <b>{member.joinedDate}</b>
          </div>
        )}
        <div className="act">
          <button className="iconbtn" type="button" aria-label="Message">
            <Icons.Mail size={14} />
          </button>
          <button className="iconbtn" type="button" aria-label="More">
            <Icons.More size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────── */
// Parse Skool date strings client-side too (mirrors server logic)
function parseSkoolDate(str: string): Date | null {
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str + "T00:00:00");
  const full = str.match(/^(\w+)\s+(\d+),\s+(\d{4})$/);
  if (full) return new Date(`${full[1]} ${full[2]}, ${full[3]}`);
  const short = str.match(/^(\w+)\s+(\d{4})$/);
  if (short) return new Date(`${short[1]} 1, ${short[2]}`);
  return null;
}

function applyFilters(
  all: SkoolMember[],
  { searchName, priceFilter, referral, joinedAfter, joinedBefore }: {
    searchName: string; priceFilter: string; referral: string;
    joinedAfter: string; joinedBefore: string;
  }
): SkoolMember[] {
  let out = all;

  if (searchName) {
    const q = searchName.toLowerCase();
    out = out.filter((m) => m.name.toLowerCase().includes(q) || m.handle.toLowerCase().includes(q));
  }

  if (priceFilter) {
    out = out.filter((m) => {
      const raw = (m.price || "").replace(/[\s,]/g, "").toLowerCase();
      const numVal = parseFloat(raw.replace(/[^0-9.]/g, "")) || 0;
      if (priceFilter === "free")   return raw === "free" || raw === "" || numVal === 0;
      if (priceFilter === "annual") return raw.includes("year") || numVal >= 300;
      // For specific price keys, find matching tier and check amounts
      const tier = PRICE_TIERS.find(t => t.key === priceFilter);
      if (tier) return tier.amounts.includes(numVal);
      return true;
    });
  }

  if (referral) {
    out = out.filter((m) => m.referralSource.toLowerCase().includes(referral.toLowerCase()));
  }

  if (joinedAfter) {
    const after = parseSkoolDate(joinedAfter);
    if (after) out = out.filter((m) => { const d = parseSkoolDate(m.joinedDate); return d !== null && d >= after; });
  }

  if (joinedBefore) {
    const before = parseSkoolDate(joinedBefore);
    if (before) {
      before.setHours(23, 59, 59, 999);
      out = out.filter((m) => { const d = parseSkoolDate(m.joinedDate); return d !== null && d <= before; });
    }
  }

  return out;
}

const PAGE_SIZE = 30;

/* ── Excel export ─────────────────────────────────────────────────────── */
function exportToExcel(members: SkoolMember[], filename: string) {
  // Build rows with friendly column names
  const rows = members.map((m, i) => ({
    "#":               i + 1,
    "Name":            m.name,
    "Handle":          m.handle,
    "Bio":             m.bio,
    "Tier":            m.tier || "Free",
    "Plan / Price":    m.price || "Free",
    "Status":          m.cancelledInfo || m.status,
    "Joined Date":     m.joinedDate,
    "Last Active":     m.activeAgo ? `Active ${m.activeAgo}` : "",
    "Renews / Access": m.renewsIn,
    "Referral Source": m.referralSource,
    "Level":           m.level,
    "Location":        m.location,
    "Avatar URL":      m.avatar,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-width: measure each column's max character length
  const cols = Object.keys(rows[0] || {});
  ws["!cols"] = cols.map((col) => ({
    wch: Math.min(
      60,
      Math.max(
        col.length + 2,
        ...rows.map((r) => String(r[col as keyof typeof r] ?? "").length)
      )
    ),
  }));

  // Style header row bold (xlsx-style not available in community xlsx, so we use outline)
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[cellAddr]) continue;
    ws[cellAddr].s = { font: { bold: true }, fill: { fgColor: { rgb: "F5C842" } } };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Members");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/* ── Export dropdown button ───────────────────────────────────────────── */
function ExportButton({
  allMembers, filteredMembers, activeTab, hasFilters,
}: {
  allMembers: SkoolMember[]; filteredMembers: SkoolMember[];
  activeTab: string; hasFilters: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const now = new Date().toISOString().slice(0, 10);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={allMembers.length === 0}
        className="btn"
      >
        <Icons.Download size={14} />
        Export
        <span
          style={{
            display: "inline-flex",
            transform: open ? "rotate(180deg)" : undefined,
            transition: "transform 0.15s ease",
          }}
        >
          <Icons.Chevron size={12} />
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-30">
          <div className="px-3.5 pt-3 pb-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Export to Excel (.xlsx)</p>
          </div>

          {/* Export filtered (only shown when filters active) */}
          {hasFilters && (
            <button
              onClick={() => {
                exportToExcel(filteredMembers, `skool-${activeTab}-filtered-${now}`);
                setOpen(false);
              }}
              className="w-full flex items-start gap-3 px-3.5 py-2.5 hover:bg-amber-50 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-amber-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-800">Filtered results</p>
                <p className="text-[11px] text-gray-400">{filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""} · current filters applied</p>
              </div>
            </button>
          )}

          {/* Export all members for this tab */}
          <button
            onClick={() => {
              exportToExcel(allMembers, `skool-${activeTab}-all-${now}`);
              setOpen(false);
            }}
            className="w-full flex items-start gap-3 px-3.5 py-2.5 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-800">All {activeTab} members</p>
              <p className="text-[11px] text-gray-400">{allMembers.length} member{allMembers.length !== 1 ? "s" : ""} · no filters</p>
            </div>
          </button>

          <div className="border-t border-gray-100 px-3.5 py-2">
            <p className="text-[10px] text-gray-400">
              Includes: name, handle, plan, joined date, active time, referral source, level
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Pagination component ─────────────────────────────────────────────── */
function Pagination({
  current, total, onChange,
}: { current: number; total: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;

  const pages: (number | "…")[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push("…");
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push("…");
    pages.push(total);
  }

  return (
    <div className="pagination">
      <button
        type="button"
        onClick={() => onChange(current - 1)}
        disabled={current === 1}
        className="linkish"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          opacity: current === 1 ? 0.35 : 1,
          pointerEvents: current === 1 ? "none" : "auto",
        }}
      >
        <Icons.ChevronL size={14} />
        Previous
      </button>

      <div className="pages">
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} style={{ padding: "0 4px", color: "var(--ink-4)" }}>
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              data-active={current === p ? "true" : "false"}
              onClick={() => onChange(p as number)}
            >
              {p}
            </button>
          )
        )}
      </div>

      <button
        type="button"
        onClick={() => onChange(current + 1)}
        disabled={current === total}
        className="linkish"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          opacity: current === total ? 0.35 : 1,
          pointerEvents: current === total ? "none" : "auto",
        }}
      >
        Next
        <Icons.ChevronR size={14} />
      </button>
    </div>
  );
}

export default function MembersPage() {
  const router = useRouter();
  const [activeTab, setActiveTab]   = useState<Tab>("active");
  const [allMembers, setAllMembers] = useState<SkoolMember[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [userEmail, setUserEmail]   = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSkoolPages, setTotalSkoolPages] = useState(0);
  const [elapsed, setElapsed]       = useState(0);
  const [fromCache, setFromCache]   = useState(false);
  const [cachedAt, setCachedAt]     = useState<number | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [searchName,   setSearchName]   = useState("");
  const [joinedAfter,  setJoinedAfter]  = useState("");
  const [joinedBefore, setJoinedBefore] = useState("");
  const [priceFilter,  setPriceFilter]  = useState<string>("");
  const [referral,     setReferral]     = useState("");

  // Derived: filtered + paginated
  const filteredMembers = applyFilters(allMembers, { searchName, priceFilter, referral, joinedAfter, joinedBefore });
  const totalFilteredPages = Math.ceil(filteredMembers.length / PAGE_SIZE);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const members = filteredMembers.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    try {
      const raw = document.cookie.split("; ").find((c) => c.startsWith("skool_user="));
      if (raw) { const val = decodeURIComponent(raw.split("=")[1]); setUserEmail(JSON.parse(val).email || ""); }
    } catch { /* ignore */ }
  }, []);

  // Scrape fetches ALL members across all pages — filters applied client-side
  const scrape = useCallback(async (tab: Tab, forceRefresh = false) => {
    setLoading(true);
    setError("");
    setCurrentPage(1);
    setElapsed(0);
    setFromCache(false);

    // Only run elapsed timer when actually scraping (not cache hit)
    // We start it optimistically and stop early if cache returns instantly
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    elapsedRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab, forceRefresh }),
      });
      const data = await res.json();
      if (res.status === 401) { router.push("/login"); return; }
      if (!res.ok || data.error) throw new Error(data.error || "Scrape failed");
      setAllMembers(data.members);
      setTotalSkoolPages(data.totalPages ?? 1);
      setFromCache(data.fromCache ?? false);
      setCachedAt(data.cachedAt ?? null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
    }
  }, [router]);

  // Auto-load on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { scrape("active"); }, []);

  const handleForceRefresh = () => scrape(activeTab, true);
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };
  const handleClearFilters = () => {
    setSearchName(""); setJoinedAfter(""); setJoinedBefore("");
    setPriceFilter(""); setReferral("");
    setCurrentPage(1);
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    void scrape(tab);
  };

  // Reset to page 1 whenever any filter changes
  useEffect(() => { setCurrentPage(1); }, [searchName, priceFilter, referral, joinedAfter, joinedBefore]);

  const hasFilters = !!(searchName || joinedAfter || joinedBefore || priceFilter || referral);

  return (
    <div className="app">
      <Sidebar active="members" userEmail={userEmail} onSignOut={handleLogout} />

      <main className="main">
        <TopBar
          crumbs={[
            { label: "Workspace" },
            { label: "Aegis Nutrition Academy" },
            { label: "Members", current: true },
          ]}
        />

        <div className="page">
          <section className="page-hdr">
            <div className="page-hdr-l">
              <h2>
                Members <em>directory</em>
              </h2>
              {!loading && (
                <div className="page-hdr-meta">
                  <span>
                    <b>{allMembers.length}</b> members
                  </span>
                  <span className="dot" />
                  <span>
                    across <b>{totalSkoolPages}</b> pages
                  </span>
                  {cachedAt && (
                    <>
                      <span className="dot" />
                      <span className="cache-tag">
                        <i />
                        {fromCache ? "From cache" : "Live fetch"} ·{" "}
                        {(() => {
                          const s = Math.floor((Date.now() - cachedAt) / 1000);
                          return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`;
                        })()}
                      </span>
                    </>
                  )}
                  {hasFilters && (
                    <>
                      <span className="dot" />
                      <span>
                        <b>{filteredMembers.length}</b> match filters
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="page-hdr-r">
              <button className="btn" type="button" onClick={() => setShowFilters((v) => !v)}>
                <Icons.Filter size={14} /> Filter
                {hasFilters && (
                  <span
                    style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }}
                    aria-hidden={true}
                  />
                )}
              </button>
              <button
                className="btn"
                data-variant="accent"
                type="button"
                onClick={handleForceRefresh}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : <Icons.Refresh size={14} />}
                {loading ? `${elapsed}s…` : "Refresh"}
              </button>
              <ExportButton
                allMembers={allMembers}
                filteredMembers={filteredMembers}
                activeTab={activeTab}
                hasFilters={hasFilters}
              />
            </div>
          </section>

        {/* ── Filter panel ────────────────────────────────────────── */}
        {showFilters && (
          <div className="card">
            <div className="card-hdr">
              <h3>
                Filters · <b>refine the list</b>
              </h3>
              <button className="linkish" type="button" onClick={handleClearFilters}>
                Reset all
              </button>
            </div>
            <div className="filters">
              <div className="field field-3">
                <label htmlFor="f-tab">Member list</label>
                <div className="select-wrap">
                  <select id="f-tab" value={activeTab} onChange={(e) => handleTabChange(e.target.value as Tab)}>
                    {TABS.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <Icons.Chevron size={14} />
                </div>
              </div>

              <div className="field field-3">
                <label htmlFor="f-q">Name or handle</label>
                <div className="input-search">
                  <Icons.Search size={14} />
                  <input
                    id="f-q"
                    className="input"
                    placeholder={`Search ${allMembers.length} members…`}
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                  />
                </div>
              </div>

              <div className="field field-3">
                <label htmlFor="f-src">Referral source</label>
                <div className="select-wrap">
                  <select id="f-src" value={referral} onChange={(e) => setReferral(e.target.value)}>
                    <option value="">All sources</option>
                    {REFERRAL_OPTIONS.filter(Boolean).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <Icons.Chevron size={14} />
                </div>
              </div>

              <div className="field field-full">
                <label>Joined date range</label>
                <div className="daterange">
                  <div className="input-search">
                    <Icons.Cal size={14} />
                    <input className="input" type="date" value={joinedAfter} onChange={(e) => setJoinedAfter(e.target.value)} />
                  </div>
                  <span className="arrow">→</span>
                  <div className="input-search">
                    <Icons.Cal size={14} />
                    <input className="input" type="date" value={joinedBefore} onChange={(e) => setJoinedBefore(e.target.value)} />
                  </div>
                </div>
                {(joinedAfter || joinedBefore) && (
                  <p style={{ fontSize: 11, marginTop: 8, color: "var(--accent)", fontWeight: 500 }}>
                    {joinedAfter && joinedBefore
                      ? `Showing members who joined between ${new Date(joinedAfter).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} and ${new Date(joinedBefore).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                      : joinedAfter
                        ? `Showing members who joined after ${new Date(joinedAfter).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                        : `Showing members who joined before ${new Date(joinedBefore).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                  </p>
                )}
              </div>

              <div className="field field-full">
                <label>Subscription plan</label>
                <div className="plans">
                  {PRICE_TIERS.map(({ key, label, sub, amounts }) => {
                    const count =
                      key === ""
                        ? allMembers.length
                        : allMembers.filter((m) => {
                            const raw = (m.price || "").replace(/[\s,]/g, "").toLowerCase();
                            const num = parseFloat(raw.replace(/[^0-9.]/g, "")) || 0;
                            if (key === "free") return raw === "free" || num === 0;
                            if (key === "annual") return raw.includes("year") || num >= 300;
                            return amounts.includes(num);
                          }).length;
                    return (
                      <button
                        key={key || "all"}
                        type="button"
                        className="plan"
                        data-active={priceFilter === key ? "true" : "false"}
                        onClick={() => setPriceFilter(key)}
                      >
                        <b>{label}</b>
                        <small>{sub || "Monthly"} · {count}</small>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="filters-footer">
              <span>
                <b>{filteredMembers.length}</b> matching · <b>{allMembers.length - filteredMembers.length}</b> hidden
              </span>
              {hasFilters && (
                <button className="linkish" type="button" onClick={handleClearFilters}>
                  Clear filters →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Cache info banner ────────────────────────────────────── */}
        {!loading && fromCache && cachedAt && (
          <div className="banner" role="status">
            <div className="banner-ico">
              <Icons.Cache size={16} />
            </div>
            <div className="banner-body">
              <strong>
                Showing cached data · fetched{" "}
                {(() => {
                  const s = Math.floor((Date.now() - cachedAt) / 1000);
                  return s < 60 ? `${s} seconds ago` : `${Math.floor(s / 60)} minutes ago`;
                })()}
              </strong>
              <p>
                New members who joined since won&apos;t appear. <b>Refresh</b> to pull the latest.
              </p>
            </div>
            <button className="btn" data-variant="primary" type="button" onClick={handleForceRefresh} disabled={loading}>
              <Icons.Refresh size={14} /> Fetch new data
            </button>
          </div>
        )}
        {error && (
          <div className="banner" role="alert">
            <div
              className="banner-ico"
              style={{
                background: "color-mix(in oklab,var(--neg) 10%,transparent)",
                color: "var(--neg)",
              }}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <div className="banner-body">
              <strong style={{ color: "var(--neg)" }}>Error</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        <div className="card">
          <div className="list-toolbar">
            <h3>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h3>
            <span>
              {filteredMembers.length} of {allMembers.length} members
            </span>
            <div className="spacer" />
          </div>

          {loading ? (
            <div
              style={{
                padding: "60px 22px",
                textAlign: "center",
                color: "var(--ink-3)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
            >
              <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
              <div style={{ marginTop: 12 }}>
                {elapsed < 2 ? "Checking cache…" : `Scraping all pages · ${elapsed}s elapsed`}
              </div>
              {elapsed >= 2 && totalSkoolPages > 0 && (
                <div
                  style={{
                    width: 200,
                    margin: "8px auto 0",
                    height: 3,
                    background: "var(--surface-sunk)",
                    borderRadius: 99,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      background: "var(--accent)",
                      width:
                        totalSkoolPages > 0
                          ? `${Math.min(95, (elapsed / (totalSkoolPages * 2.5)) * 100)}%`
                          : `${Math.min(60, elapsed * 3)}%`,
                      transition: "width 1s",
                      borderRadius: 99,
                    }}
                  />
                </div>
              )}
            </div>
          ) : members.length === 0 ? (
            <div
              style={{
                padding: "60px 22px",
                textAlign: "center",
                color: "var(--ink-3)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
            >
              No members match these filters.{" "}
              {hasFilters && (
                <button className="linkish" type="button" onClick={handleClearFilters}>
                  Clear filters →
                </button>
              )}
            </div>
          ) : (
            <div className="members">
              {members.map((m, i) => (
                <MemberRow key={m.id} member={m} index={i} />
              ))}
            </div>
          )}

          {!loading && filteredMembers.length > PAGE_SIZE && (
            <>
              <Pagination
                current={currentPage}
                total={totalFilteredPages}
                onChange={(p) => {
                  setCurrentPage(p);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
              <div className="filters-footer" style={{ borderTop: "1px solid var(--hair)", justifyContent: "center" }}>
                Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredMembers.length)} of {filteredMembers.length}{" "}
                members
              </div>
            </>
          )}
        </div>

        </div>
      </main>
    </div>
  );
}
