"use client";

import { Icons, type IconKey } from "@/components/ui/icons";

interface NavItem {
  id: string;
  label: string;
  icon: IconKey;
  shortcut?: string;
}

const PRIMARY: NavItem[] = [
  // { id: "dashboard", label: "Overview", icon: "Dash", shortcut: "1" },
  { id: "members", label: "Members", icon: "Members", shortcut: "2" },
  // { id: "segments", label: "Segments", icon: "Segments", shortcut: "3" },
  // { id: "revenue", label: "Revenue", icon: "Revenue", shortcut: "4" },
];

const TOOLS: NavItem[] = [
  { id: "exports", label: "Exports", icon: "Download" },
  { id: "settings", label: "Settings", icon: "Settings" },
];

export function Sidebar({
  active = "members",
  userEmail = "",
  onSignOut,
}: {
  active?: string;
  userEmail?: string;
  onSignOut?: () => void;
}) {
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : "HA";
  return (
    <aside className="sb">
      <div className="sb-brand">
        <div className="sb-mark">A</div>
        <h1>
          Aegis
          <small>NUTRITION&nbsp;ACADEMY</small>
        </h1>
      </div>
      <div className="sb-section">Workspace</div>
      <nav className="sb-nav">
        {PRIMARY.map((item) => {
          const G = Icons[item.icon];
          return (
            <button key={item.id} type="button" className="sb-link" data-active={item.id === active}>
              <G size={15} />
              <span>{item.label}</span>
              {item.shortcut && <kbd>{item.shortcut}</kbd>}
            </button>
          );
        })}
      </nav>
      <div className="sb-section">Tools</div>
      <nav className="sb-nav">
        {TOOLS.map((item) => {
          const G = Icons[item.icon];
          return (
            <button key={item.id} type="button" className="sb-link" data-active={false}>
              <G size={15} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sb-spacer" />
      <div className="sb-account">
        <div className="sb-account-avatar">{initials}</div>
        <div className="sb-account-name">{userEmail || "Account"}</div>
        <button className="sb-signout" type="button" aria-label="Sign out" onClick={onSignOut}>
          <Icons.Signout size={14} />
        </button>
      </div>
    </aside>
  );
}
