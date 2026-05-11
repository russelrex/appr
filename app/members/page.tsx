"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { useRouter } from "next/navigation";

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
const AVATAR_COLORS    = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#14b8a6"];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}
function getAvatarColor(name: string) {
  let h = 0;
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/* ── Referral badge ───────────────────────────────────────────────────── */
function ReferralBadge({ source }: { source: string }) {
  if (!source) return null;
  const lower = source.toLowerCase();

  const icons: Record<string, React.ReactNode> = {
    google: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
    instagram: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0">
        <defs><radialGradient id="ig-m" cx="30%" cy="107%" r="150%">
          <stop offset="0%"   stopColor="#ffd600"/>
          <stop offset="30%"  stopColor="#ff6930"/>
          <stop offset="60%"  stopColor="#fe3b92"/>
          <stop offset="100%" stopColor="#a334fa"/>
        </radialGradient></defs>
        <rect width="24" height="24" rx="5" fill="url(#ig-m)"/>
        <circle cx="12" cy="12" r="4" fill="none" stroke="white" strokeWidth="1.8"/>
        <circle cx="17.5" cy="6.5" r="1" fill="white"/>
      </svg>
    ),
    youtube: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0">
        <rect width="24" height="24" rx="4" fill="#FF0000"/>
        <polygon points="10,8 16,12 10,16" fill="white"/>
      </svg>
    ),
    facebook: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0">
        <rect width="24" height="24" rx="4" fill="#1877F2"/>
        <path d="M13 21v-7h2.5l.5-3H13V9.5c0-.8.4-1.5 1.5-1.5H16V5.5S15 5 13.5 5C11.5 5 10 6.5 10 8.5V11H8v3h2v7h3z" fill="white"/>
      </svg>
    ),
    twitter: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0">
        <rect width="24" height="24" rx="4" fill="#000"/>
        <path d="M17.5 4h2.5l-5.8 6.6L21 20h-5l-3.7-4.8L7.7 20H5.2l6.2-7.1L3 4h5.2l3.4 4.4L17.5 4zm-.9 14.4h1.4L7.5 5.4H6l10.6 13z" fill="white"/>
      </svg>
    ),
  };

  const found = Object.entries(icons).find(([k]) => lower.includes(k));
  return (
    <div className="flex items-center gap-1.5">
      {found?.[1]}
      <span className="text-gray-500">Joined from <span className="font-medium text-gray-700">{source}</span></span>
    </div>
  );
}

/* ── Tier pill ────────────────────────────────────────────────────────── */
function TierPill({ tier }: { tier: string }) {
  if (!tier) return null;
  const isPremium = tier.toLowerCase().includes("premium");
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
      isPremium ? "bg-blue-50 text-blue-600 border border-blue-100" : "bg-gray-100 text-gray-500"
    }`}>
      {isPremium && (
        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="currentColor">
          <polygon points="6,1 7.8,4.6 11.7,5.1 9,7.7 9.6,11.6 6,9.7 2.4,11.6 3,7.7 0.3,5.1 4.2,4.6"/>
        </svg>
      )}
      {tier}
    </span>
  );
}

/* ── Price badge ──────────────────────────────────────────────────────── */
function PriceBadge({ price }: { price: string }) {
  if (!price) return null;
  const isFree   = price.toLowerCase() === "free";
  const is35     = price.includes("35");
  const is129    = price.includes("129");
  const isAnnual = price.toLowerCase().includes("year");

  let label = price;
  let cls   = "bg-gray-100 text-gray-500 border-gray-200";

  if (isFree)        { cls = "bg-emerald-50 text-emerald-600 border-emerald-100"; label = "Free"; }
  else if (is35)     { cls = "bg-violet-50 text-violet-600 border-violet-100";    label = "$35/mo"; }
  else if (is129)    { cls = "bg-blue-50 text-blue-600 border-blue-100";           label = "$129/mo"; }
  else if (isAnnual) { cls = "bg-amber-50 text-amber-700 border-amber-100";        label = "Annual"; }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {label}
    </span>
  );
}


function StatusPill({ status, cancelledInfo }: { status: string; cancelledInfo?: string }) {
  if (status === "cancelled" || cancelledInfo) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-100">
        <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.5 3.86L5.18 9.5a1 1 0 01-1.41 0L1.5 7.24"/></svg>
        {cancelledInfo || "Cancelled"}
      </span>
    );
  }
  return null;
}

/* ── Meta row ─────────────────────────────────────────────────────────── */
function MetaItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[13px] text-gray-500">
      <span className="text-gray-400">{icon}</span>
      {children}
    </div>
  );
}

const ClockIcon = () => (
  <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);
const CalendarIcon = () => (
  <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const TagIcon = () => (
  <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
    <line x1="7" y1="7" x2="7.01" y2="7"/>
  </svg>
);
const RefreshIcon = () => (
  <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
  </svg>
);
const WarningIcon = () => (
  <svg className="w-3.5 h-3.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

/* ── Member Card ──────────────────────────────────────────────────────── */
function MemberCard({ member }: { member: SkoolMember }) {
  const isCancelled = member.status === "cancelled" || !!member.cancelledInfo;
  const color = getAvatarColor(member.name);

  return (
    <div className="group flex items-start gap-4 py-5 px-6 hover:bg-gray-50/80 transition-colors border-b border-gray-100 last:border-0">

      {/* ── Avatar ────────────────────────────────────────────────── */}
      <div className="relative flex-shrink-0">
        {member.avatar
          ? <img src={member.avatar} alt={member.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-sm"/>
          : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm ring-2 ring-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              {getInitials(member.name)}
            </div>
          )
        }
        {/* Level badge */}
        <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-[#2563eb] flex items-center justify-center text-white text-[9px] font-bold border-2 border-white shadow">
          {member.level || 1}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">

        {/* Name row */}
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-[15px] font-semibold text-gray-900 leading-tight">{member.name}</span>
          <TierPill tier={member.tier}/>
          <PriceBadge price={member.price}/>
          {isCancelled && <StatusPill status={member.status} cancelledInfo={member.cancelledInfo}/>}
        </div>

        {/* Handle — always on its own line, subdued */}
        {member.handle && (
          <div className="text-[12px] text-gray-400 font-mono mb-2 tracking-tight">
            {member.handle}
          </div>
        )}

        {/* Bio */}
        {member.bio && (
          <p className="text-[13px] text-gray-500 leading-relaxed mb-3 line-clamp-2">
            {member.bio}
          </p>
        )}

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {member.activeAgo && (
            <MetaItem icon={<ClockIcon/>}>
              Active <span className="text-gray-700 font-medium ml-0.5">{member.activeAgo}</span>
            </MetaItem>
          )}
          {member.price && (
            <MetaItem icon={<TagIcon/>}>
              <span className="text-gray-700 font-medium">{member.price}</span>
            </MetaItem>
          )}
          {member.joinedDate && (
            <MetaItem icon={<CalendarIcon/>}>
              Joined <span className="text-gray-700 font-medium ml-0.5">{member.joinedDate}</span>
            </MetaItem>
          )}
          {isCancelled ? (
            <MetaItem icon={<WarningIcon/>}>
              <span className="text-red-500 font-medium">{member.cancelledInfo || "Cancelled"}</span>
            </MetaItem>
          ) : member.renewsIn ? (
            <MetaItem icon={<RefreshIcon/>}>
              <span className="text-gray-700 font-medium">{member.renewsIn}</span>
            </MetaItem>
          ) : null}
          {member.referralSource && (
            <div className="col-span-2 mt-0.5">
              <ReferralBadge source={member.referralSource}/>
            </div>
          )}
        </div>
      </div>

      {/* ── Actions ───────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-shrink-0 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold text-gray-500 hover:text-gray-800 hover:border-gray-300 hover:shadow-sm transition-all uppercase tracking-wider">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          Chat
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold text-gray-500 hover:text-gray-800 hover:border-gray-300 hover:shadow-sm transition-all uppercase tracking-wider">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
          Membership
        </button>
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
      switch (priceFilter) {
        case "free":   return raw === "free" || raw === "" || numVal === 0;
        case "35":     return numVal === 35;
        case "129":    return numVal === 129;
        case "annual": return raw.includes("year") || numVal >= 300;
        default:       return true;
      }
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
        onClick={() => setOpen((v) => !v)}
        disabled={allMembers.length === 0}
        className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-[13px] font-medium hover:border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <line x1="9" y1="15" x2="12" y2="18"/><line x1="15" y1="15" x2="12" y2="18"/>
        </svg>
        Export
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
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
    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
      <button
        onClick={() => onChange(current - 1)}
        disabled={current === 1}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Previous
      </button>

      <div className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-[13px]">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={`w-8 h-8 rounded-full text-[13px] font-medium transition-colors ${
                current === p
                  ? "bg-[#f5c842] text-gray-900 font-bold"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
              }`}
            >
              {p}
            </button>
          )
        )}
      </div>

      <button
        onClick={() => onChange(current + 1)}
        disabled={current === total}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Next
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
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

  const handleTabChange = (tab: Tab) => { setActiveTab(tab); scrape(tab); };
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

  // Reset to page 1 whenever any filter changes
  useEffect(() => { setCurrentPage(1); }, [searchName, priceFilter, referral, joinedAfter, joinedBefore]);

  const hasFilters = !!(searchName || joinedAfter || joinedBefore || priceFilter || referral);

  return (
    <div className="min-h-screen bg-[#f5f4f0]">

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#f5c842] flex items-center justify-center shadow-sm">
              <span className="font-black text-gray-900 text-sm">S</span>
            </div>
            <span className="font-bold text-gray-900 text-[15px]">Skool</span>
            <span className="text-gray-300 hidden sm:inline">·</span>
            <span className="text-[13px] text-gray-400 hidden sm:inline">Aegis Nutrition Academy</span>
          </div>
          <div className="flex items-center gap-3">
            {userEmail && (
              <span className="text-[12px] text-gray-400 hidden sm:inline bg-gray-100 px-2.5 py-1 rounded-full">
                {userEmail}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Page title ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Members</h1>
            {!loading && (
              <p className="text-[12px] text-gray-400 mt-0.5">
                {hasFilters
                  ? <>{filteredMembers.length} of {allMembers.length} members <span className="text-amber-500">· filtered</span></>
                  : <>{allMembers.length} members across {totalSkoolPages} pages</>
                }
              </p>
            )}
            {/* Cache status */}
            {!loading && cachedAt && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                  fromCache
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-blue-50 border-blue-200 text-blue-700"
                }`}>
                  {fromCache ? (
                    <><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>From cache</>
                  ) : (
                    <><svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Live fetch</>
                  )}
                </span>
                <span className="text-[11px] text-gray-400">
                  {(() => {
                    const secs = Math.floor((Date.now() - cachedAt) / 1000);
                    if (secs < 60) return `${secs}s ago`;
                    const mins = Math.floor(secs / 60);
                    return `${mins}m ago · auto-expires in ${30 - mins}m`;
                  })()}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-[13px] font-medium transition-colors ${
                showFilters || hasFilters
                  ? "bg-amber-50 border-amber-300 text-amber-800"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Filter
              {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-amber-500"/>}
            </button>

            {/* Refresh — fetches new data from Skool, bypasses cache */}
            <button
              onClick={handleForceRefresh}
              disabled={loading}
              title="Fetch latest members from Skool (picks up new sign-ups)"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#f5c842] hover:bg-[#e6bb38] disabled:opacity-60 text-gray-900 rounded-lg text-[13px] font-bold transition-colors"
            >
              {loading
                ? <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>}
              {loading ? "Fetching…" : "Refresh"}
            </button>

            <ExportButton
              allMembers={allMembers}
              filteredMembers={filteredMembers}
              activeTab={activeTab}
              hasFilters={hasFilters}
            />
          </div>
        </div>

        {/* ── Filter panel ────────────────────────────────────────── */}
        {showFilters && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4 shadow-sm">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-[13px] font-semibold text-gray-700">Filters</h3>
              {hasFilters && (
                <button onClick={handleClearFilters} className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors">
                  Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                  Name or handle
                </label>
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <input
                    type="text" value={searchName} onChange={(e) => setSearchName(e.target.value)}
                    placeholder="Search…"
                    className="w-full pl-8 pr-3 py-2 text-[13px] border border-gray-200 rounded-lg bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                  Referral source
                </label>
                <select
                  value={referral} onChange={(e) => setReferral(e.target.value)}
                  className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  {REFERRAL_OPTIONS.map((r) => <option key={r} value={r}>{r || "All sources"}</option>)}
                </select>
              </div>

              <div className="col-span-2">
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                  Joined date range
                </label>
                <div className="flex items-center gap-0 border border-gray-200 rounded-lg bg-gray-50 overflow-hidden focus-within:ring-2 focus-within:ring-amber-300 focus-within:border-amber-300">
                  {/* Calendar icon */}
                  <div className="pl-3 pr-2 flex items-center flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  {/* From date */}
                  <input
                    type="date"
                    value={joinedAfter}
                    onChange={(e) => setJoinedAfter(e.target.value)}
                    className="flex-1 py-2 px-1 text-[13px] bg-transparent border-none outline-none text-gray-900 min-w-0"
                  />
                  {/* Arrow divider */}
                  <div className="flex items-center px-2 flex-shrink-0">
                    <svg className="w-3.5 h-3.5 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </div>
                  {/* To date */}
                  <input
                    type="date"
                    value={joinedBefore}
                    onChange={(e) => setJoinedBefore(e.target.value)}
                    className="flex-1 py-2 px-1 text-[13px] bg-transparent border-none outline-none text-gray-900 min-w-0"
                  />
                  {/* Clear button — only shown when either date is set */}
                  {(joinedAfter || joinedBefore) && (
                    <button
                      onClick={() => { setJoinedAfter(""); setJoinedBefore(""); }}
                      className="pr-3 pl-1 flex items-center text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
                {/* Range summary label */}
                {(joinedAfter || joinedBefore) && (
                  <p className="text-[11px] text-amber-600 mt-1.5 font-medium">
                    {joinedAfter && joinedBefore
                      ? `Showing members who joined between ${new Date(joinedAfter).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })} and ${new Date(joinedBefore).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}`
                      : joinedAfter
                        ? `Showing members who joined after ${new Date(joinedAfter).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}`
                        : `Showing members who joined before ${new Date(joinedBefore).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}`
                    }
                  </p>
                )}
              </div>

              <div className="col-span-2 border-t border-gray-100 pt-3">
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                  Subscription plan
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "",       label: "All plans",    sub: ""              },
                    { key: "free",   label: "Free",         sub: "Lifetime"      },
                    { key: "35",     label: "$35 / month",  sub: "Monthly Basic" },
                    { key: "129",    label: "$129 / month", sub: "Monthly Pro"   },
                    { key: "annual", label: "$300+ / year", sub: "Annual"        },
                  ].map(({ key, label, sub }) => {
                    const active = priceFilter === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setPriceFilter(key)}
                        className={`flex flex-col items-start px-3.5 py-2 rounded-xl border text-left transition-all ${
                          active
                            ? "bg-gray-900 border-gray-900 text-white shadow-sm"
                            : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <span className={`text-[13px] font-semibold ${active ? "text-white" : "text-gray-800"}`}>
                          {label}
                        </span>
                        {sub && (
                          <span className={`text-[11px] mt-0.5 ${active ? "text-gray-300" : "text-gray-400"}`}>
                            {sub}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="col-span-2 flex items-center justify-between pt-2 border-t border-gray-100">
                <p className="text-[12px] text-gray-400">
                  {hasFilters
                    ? <><span className="font-semibold text-gray-700">{filteredMembers.length}</span> of <span className="font-semibold text-gray-700">{allMembers.length}</span> members match</>
                    : <><span className="font-semibold text-gray-700">{allMembers.length}</span> members total</>
                  }
                </p>
                {hasFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="text-[12px] text-gray-400 hover:text-gray-700 underline underline-offset-2 transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Cache info banner ────────────────────────────────────── */}
        {!loading && fromCache && cachedAt && (
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 mb-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-800">
                  Showing cached data
                  <span className="font-normal text-gray-400 ml-1">
                    · fetched {(() => {
                      const secs = Math.floor((Date.now() - cachedAt) / 1000);
                      if (secs < 60) return `${secs} seconds ago`;
                      const mins = Math.floor(secs / 60);
                      return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
                    })()}
                  </span>
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  New members who joined since then won't appear. Click <strong className="text-gray-600">Refresh</strong> to fetch the latest data from Skool.
                </p>
              </div>
            </div>
            <button
              onClick={handleForceRefresh}
              disabled={loading}
              className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-lg text-[12px] font-semibold transition-colors ml-4"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
              </svg>
              Fetch new data
            </button>
          </div>
        )}
        {/* ── Error ───────────────────────────────────────────────── */}
        {error && (
          <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-[13px] text-red-600">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* ── Main card ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Tabs */}
          <div className="flex items-center justify-between px-6 border-b border-gray-100">
            <nav className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => handleTabChange(t.key)}
                  className={`relative px-4 py-3.5 text-[13px] font-medium transition-colors ${
                    activeTab === t.key ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {t.label}
                  {activeTab === t.key && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gray-900 rounded-t-full"/>
                  )}
                </button>
              ))}
            </nav>
            {!loading && (
              <span className="text-[12px] text-gray-400 font-medium">
                {hasFilters
                  ? `${filteredMembers.length} / ${allMembers.length} members`
                  : `${allMembers.length} members`}
              </span>
            )}
          </div>

          {/* Body */}
          {loading ? (
            <div className="py-24 text-center">
              <div className="relative w-10 h-10 mx-auto mb-5">
                <svg className="w-10 h-10 animate-spin text-[#f5c842]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
              </div>
              {elapsed < 2 ? (
                <>
                  <p className="text-[14px] font-medium text-gray-700">Checking cache…</p>
                  <p className="text-[12px] text-gray-400 mt-1">Loading instantly if cached</p>
                </>
              ) : (
                <>
                  <p className="text-[14px] font-medium text-gray-700">Scraping all pages from Skool…</p>
                  <p className="text-[12px] text-gray-400 mt-1.5">
                    Fetching {totalSkoolPages > 0 ? `${totalSkoolPages} pages` : "all pages"} · {elapsed}s elapsed
                  </p>
                  <div className="mt-4 mx-auto w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#f5c842] rounded-full transition-all duration-1000"
                      style={{ width: totalSkoolPages > 0 ? `${Math.min(95, (elapsed / (totalSkoolPages * 2.5)) * 100)}%` : `${Math.min(60, elapsed * 3)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-300 mt-2">
                    {totalSkoolPages > 1 ? `~${Math.round(totalSkoolPages * 2.5)}s total` : "This may take 30–60 seconds"}
                  </p>
                </>
              )}
            </div>
          ) : members.length === 0 ? (
            <div className="py-24 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                  <path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <p className="text-[14px] font-semibold text-gray-700 mb-1">No members found</p>
              <p className="text-[12px] text-gray-400">
                {hasFilters ? "Try adjusting or clearing your filters" : "No members in this tab"}
              </p>
            </div>
          ) : (
            <>
              <ul>
                {members.map((m) => (
                  <li key={m.id}>
                    <MemberCard member={m}/>
                  </li>
                ))}
              </ul>
              {/* Pagination footer */}
              {filteredMembers.length > PAGE_SIZE && (
                <>
                  <Pagination
                    current={currentPage}
                    total={totalFilteredPages}
                    onChange={(p) => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  />
                  <div className="pb-3 text-center text-[12px] text-gray-400">
                    Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filteredMembers.length)} of {filteredMembers.length} members
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
