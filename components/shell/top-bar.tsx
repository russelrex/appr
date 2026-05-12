"use client";

import { Icons } from "@/components/ui/icons";

export function TopBar({ crumbs }: { crumbs: { label: string; current?: boolean }[] }) {
  return (
    <header className="main-top">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: "contents" }}>
            {c.current ? <b>{c.label}</b> : <span>{c.label}</span>}
            {i < crumbs.length - 1 && <span>/</span>}
          </span>
        ))}
      </div>
      <div className="main-top-actions">
        {/* <div className="cmdk">
          <Icons.Search size={13} />
          <span>Search anything</span>
          <kbd>⌘K</kbd>
        </div> */}
        {/* <button className="btn btn-icon" type="button" title="Notifications">
          <Icons.Bell size={15} />
        </button> */}
      </div>
    </header>
  );
}
