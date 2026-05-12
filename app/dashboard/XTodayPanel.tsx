"use client";

import { useEffect, useState } from "react";
import { Twitter, ExternalLink, MessageSquare, Megaphone, GitBranch, RefreshCw, Loader2 } from "lucide-react";

type Item =
  | { kind: "post"; ts: string; slug?: string; mainId: string; linkReplyId?: string; promoId?: string; text: string }
  | { kind: "reply"; ts: string; targetUser?: string; targetTweetId?: string; tweetId: string; text: string; authorFollowers?: number }
  | { kind: "thread"; ts: string; slug: string; title: string; rootTweetId: string; tweetIds: string[]; texts: string[] };

type Resp = {
  items: Item[];
  totals: { posts: number; replies: number; threads: number; totalTweets: number };
  fetchedAt: string;
};

function timeAgo(iso: string) {
  const ms = Date.now() - Date.parse(iso);
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

function timeLocal(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function XTodayPanel() {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const r = await fetch("/api/dashboard/x-today", { cache: "no-store" });
    setData(await r.json());
    setLoading(false);
  }
  useEffect(() => { load(); const t = setInterval(load, 20_000); return () => clearInterval(t); }, []);

  return (
    <section className="border border-rule bg-bg-1 mb-6">
      <div className="px-4 py-2.5 border-b border-rule flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-2">
          <Twitter className="w-3.5 h-3.5" />
          Today on X
          {data && (
            <span className="ml-2 text-[10px] text-ink-3">
              {data.totals.totalTweets} tweet{data.totals.totalTweets === 1 ? "" : "s"} · {data.totals.posts} post{data.totals.posts === 1 ? "" : "s"}
              {data.totals.replies > 0 && ` · ${data.totals.replies} repl${data.totals.replies === 1 ? "y" : "ies"}`}
              {data.totals.threads > 0 && ` · ${data.totals.threads} thread${data.totals.threads === 1 ? "" : "s"}`}
            </span>
          )}
        </span>
        <button onClick={load} className="text-[10px] text-ink-3 hover:text-ink-0 flex items-center gap-1 uppercase tracking-[0.18em]">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          refresh
        </button>
      </div>

      {loading ? (
        <div className="p-6 text-[12px] text-ink-3">loading…</div>
      ) : !data || data.items.length === 0 ? (
        <div className="p-6 text-[12px] text-ink-3">
          Nothing posted to X yet today. Auto-tweets fire at 8 AM with the daily article batch; threads at 11 AM.
        </div>
      ) : (
        <div className="divide-y divide-rule">
          {data.items.map((it, i) => (
            <div key={i} className="px-4 py-3">
              {it.kind === "post" && (
                <div>
                  <RowMeta
                    icon={<MessageSquare className="w-3 h-3 text-emerald-700" />}
                    label="auto-post"
                    color="text-emerald-700"
                    ts={it.ts}
                  />
                  <div className="text-[12.5px] text-ink-0 leading-relaxed whitespace-pre-wrap mt-1">{it.text}</div>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px]">
                    <TweetLink id={it.mainId} label="main tweet" />
                    {it.linkReplyId && <TweetLink id={it.linkReplyId} label="link reply" />}
                    {it.promoId && (
                      <span className="flex items-center gap-1 text-ink-3">
                        <Megaphone className="w-3 h-3" />
                        <TweetLink id={it.promoId} label="promo reply" />
                      </span>
                    )}
                    {it.slug && (
                      <a href={`https://kanzenai.com/articles/${it.slug}`} target="_blank" rel="noopener"
                         className="ml-auto text-ink-3 hover:text-ink-0 flex items-center gap-1">
                        article <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {it.kind === "reply" && (
                <div>
                  <RowMeta
                    icon={<MessageSquare className="w-3 h-3 text-amber-800" />}
                    label={`reply → @${it.targetUser ?? "?"}`}
                    color="text-amber-800"
                    ts={it.ts}
                    extra={it.authorFollowers ? `${it.authorFollowers.toLocaleString()} followers` : undefined}
                  />
                  <div className="text-[12.5px] text-ink-0 leading-relaxed whitespace-pre-wrap mt-1">{it.text}</div>
                  <div className="flex items-center gap-3 mt-2 text-[11px]">
                    <TweetLink id={it.tweetId} label="our reply" />
                    {it.targetTweetId && <TweetLink id={it.targetTweetId} label="original" />}
                  </div>
                </div>
              )}

              {it.kind === "thread" && (
                <div>
                  <RowMeta
                    icon={<GitBranch className="w-3 h-3 text-blue-700" />}
                    label={`thread · ${it.tweetIds.length} tweets`}
                    color="text-blue-700"
                    ts={it.ts}
                  />
                  <div className="text-[12.5px] text-ink-0 leading-relaxed mt-1 font-medium">{it.title}</div>
                  <div className="mt-2 space-y-1.5 text-[12px] text-ink-1 border-l-2 border-rule pl-3">
                    {it.texts.map((tx, j) => (
                      <div key={j}>
                        <span className="text-ink-3 mr-2">{j + 1}.</span>
                        <a href={`https://x.com/i/web/status/${it.tweetIds[j]}`} target="_blank" rel="noopener"
                           className="hover:text-ink-0">
                          {tx.split("\n")[0].slice(0, 110)}{tx.length > 110 ? "…" : ""}
                        </a>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[11px]">
                    <TweetLink id={it.rootTweetId} label="open thread" />
                    <a href={`https://kanzenai.com/articles/${it.slug}`} target="_blank" rel="noopener"
                       className="ml-auto text-ink-3 hover:text-ink-0 flex items-center gap-1">
                      article <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RowMeta({ icon, label, color, ts, extra }: { icon: React.ReactNode; label: string; color: string; ts: string; extra?: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em]">
      {icon}
      <span className={color}>{label}</span>
      <span className="text-ink-3">·</span>
      <span className="text-ink-3 normal-case tracking-normal">{timeLocal(ts)} · {timeAgo(ts)}</span>
      {extra && <span className="text-ink-3 normal-case tracking-normal">· {extra}</span>}
    </div>
  );
}

function TweetLink({ id, label }: { id: string; label: string }) {
  return (
    <a href={`https://x.com/i/web/status/${id}`} target="_blank" rel="noopener"
       className="flex items-center gap-1 text-ink-2 hover:text-ink-0 underline-offset-2 hover:underline">
      {label} <ExternalLink className="w-3 h-3" />
    </a>
  );
}
