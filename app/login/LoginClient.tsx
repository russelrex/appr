"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Diagnostics {
  VERCEL?: string | null;
  NODE_ENV?: string;
  AWS_LAMBDA?: string | null;
  cwd?: string;
}

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/members";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [showDiag, setShowDiag] = useState(false);
  const [rawLog, setRawLog] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDiagnostics(null);
    setRawLog("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Login failed. Please try again.");
        if (data.diagnostics) {
          setDiagnostics(data.diagnostics);
          setRawLog(JSON.stringify(data, null, 2));
          setShowDiag(true);
        }
        return;
      }

      router.push(from);
      router.refresh();
    } catch (err) {
      setError(`Network error: ${String(err)}`);
      setRawLog(String(err));
    } finally {
      setLoading(false);
    }
  };

  const isBrowserError =
    error.toLowerCase().includes("browser") ||
    error.toLowerCase().includes("chromium") ||
    error.toLowerCase().includes("playwright") ||
    error.toLowerCase().includes("path");

  return (
    <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#f5c842] flex items-center justify-center mb-3 shadow-sm">
            <span className="font-black text-gray-900 text-xl">S</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sign in to Skool</h1>
          <p className="text-sm text-gray-500 mt-1">Aegis Nutrition Academy · Member Manager</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 overflow-hidden">
                <div className="flex items-start gap-2.5 p-3.5">
                  <svg
                    className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-sm text-red-700 font-medium leading-snug">{error}</p>
                </div>

                {isBrowserError && (
                  <div className="border-t border-red-200 px-3.5 py-2 flex items-center justify-between bg-red-50/80">
                    <span className="text-[11px] text-red-500 font-medium">Server-side error detected</span>
                    <button
                      type="button"
                      onClick={() => setShowDiag((v) => !v)}
                      className="text-[11px] text-red-600 hover:text-red-800 underline underline-offset-2 font-semibold"
                    >
                      {showDiag ? "Hide" : "Show"} diagnostics
                    </button>
                  </div>
                )}
              </div>
            )}

            {showDiag && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 overflow-hidden">
                <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-orange-200 bg-orange-100/60">
                  <svg
                    className="w-3.5 h-3.5 text-orange-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  <span className="text-[12px] font-bold text-orange-800 uppercase tracking-wider">
                    Runtime Diagnostics
                  </span>
                </div>

                {diagnostics && (
                  <div className="px-3.5 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-b border-orange-200">
                    {[
                      { label: "VERCEL", value: diagnostics.VERCEL ?? "not set ❌" },
                      { label: "NODE_ENV", value: diagnostics.NODE_ENV ?? "unknown" },
                      { label: "AWS_LAMBDA", value: diagnostics.AWS_LAMBDA ?? "not set ❌" },
                      { label: "cwd", value: diagnostics.cwd ?? "unknown" },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider">{label}</p>
                        <p className="text-[12px] text-orange-900 font-mono break-all">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="px-3.5 py-3 border-b border-orange-200">
                  <p className="text-[11px] font-bold text-orange-700 mb-2">CHECKLIST — verify in Vercel Dashboard:</p>
                  <ul className="space-y-1.5">
                    {[
                      {
                        check: diagnostics?.VERCEL === "1" || diagnostics?.VERCEL === "true",
                        label:
                          "Env var VERCEL is set (auto-set by Vercel — if missing, something is wrong)",
                      },
                      {
                        check: !!diagnostics?.AWS_LAMBDA,
                        label:
                          "Env var AWS_LAMBDA_JS_RUNTIME = nodejs22.x is set in Vercel Dashboard → Settings → Environment Variables",
                      },
                      {
                        check: true,
                        label: "pnpm add playwright-core @sparticuz/chromium was run and committed",
                      },
                      {
                        check: true,
                        label:
                          "next.config.ts has serverExternalPackages + webpack externals for @sparticuz/chromium",
                      },
                    ].map(({ check, label }, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span
                          className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${check ? "bg-green-500 text-white" : "bg-red-400 text-white"}`}
                        >
                          {check ? "✓" : "✗"}
                        </span>
                        <span className="text-[11px] text-orange-800 leading-snug">{label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {rawLog && (
                  <div className="px-3.5 py-3">
                    <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider mb-1.5">
                      Raw server response:
                    </p>
                    <pre className="text-[10px] text-orange-900 font-mono bg-orange-100 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                      {rawLog}
                    </pre>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(rawLog)}
                      className="mt-1.5 text-[11px] text-orange-600 hover:text-orange-800 underline underline-offset-2"
                    >
                      Copy to clipboard
                    </button>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                required
                autoFocus
                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2.5 pr-10 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full py-2.5 bg-[#f5c842] hover:bg-[#e6bb38] disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="flex gap-2.5">
              <svg
                className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <p className="text-xs text-gray-400 leading-relaxed">
                Your credentials are used only to authenticate with Skool via a local browser session. They are never
                stored or sent to any third party.
              </p>
            </div>
          </div>
        </div>

        {loading && (
          <p className="text-center text-xs text-gray-400 mt-4 animate-pulse">
            Opening headless browser · logging into Skool…
          </p>
        )}
      </div>
    </div>
  );
}
