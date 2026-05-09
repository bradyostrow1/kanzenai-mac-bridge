"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Trash2, Loader2 } from "lucide-react";

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: any }
  | { type: "tool_result"; tool_use_id: string; content: string };

type Message = { role: "user" | "assistant"; content: string | ContentBlock[] };

const STORAGE_KEY = "kanzenai-chat-v1";

const SUGGESTIONS = [
  "Run the daily check",
  "How's the site doing?",
  "Write an article on best email marketing tools for real estate",
  "Any issues to fix?",
  "Show recent uptime",
];

export function ChatPanel({ onActionComplete }: { onActionComplete?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch {}
  }, []);

  // Persist + scroll
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {}
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const r = await fetch("/api/dashboard/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error ?? `${r.status}`);
        return;
      }
      setMessages([...next, ...data.messages]);
      onActionComplete?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    if (!confirm("Clear conversation history?")) return;
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#262626] flex items-center justify-between">
        <div>
          <div className="text-[#f0eee9] font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Kanzen
          </div>
          <div className="text-[11px] text-[#a3a3a3] mt-0.5">Operations bot · Claude Sonnet 4.5</div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clear}
            title="Clear conversation"
            className="p-2 text-[#a3a3a3] hover:text-[#f0eee9] hover:bg-[#171717] transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5">
        {messages.length === 0 ? (
          <EmptyState onSuggestion={send} />
        ) : (
          <div className="space-y-5 max-w-3xl">
            {messages.map((m, i) => (
              <MessageView key={i} message={m} />
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-[#a3a3a3] text-[13px]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Working…
              </div>
            )}
            {error && (
              <div className="border border-red-900 bg-red-950/30 text-red-300 px-3 py-2 text-[13px]">
                Error: {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-5 py-4 border-t border-[#262626]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            disabled={busy}
            rows={1}
            placeholder="Tell Kanzen what to do…"
            className="flex-1 bg-[#171717] border border-[#262626] focus:border-[#525252] px-3 py-2.5 text-[#f0eee9] placeholder:text-[#525252] outline-none resize-none disabled:opacity-50 text-[13px]"
            style={{ minHeight: 44, maxHeight: 200 }}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="p-2.5 bg-[#f0eee9] text-[#0a0a0a] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="mt-2 text-[10px] text-[#525252]">
          Enter to send · Shift+Enter for newline · ⌘K to focus
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="text-[#a3a3a3] text-[13px] mb-1">完全 · KANZEN</div>
      <h2 className="text-[#f0eee9] text-2xl font-bold mb-2">Hey Brady. What needs doing?</h2>
      <p className="text-[#a3a3a3] text-[14px] leading-relaxed mb-6">
        I can run audits, write articles, deploy to production, and check uptime. Tell me what you want — I'll figure out which tools to use.
      </p>
      <div className="space-y-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="block w-full text-left px-4 py-3 border border-[#262626] hover:border-[#525252] hover:bg-[#171717] text-[#f0eee9] text-[13px] transition"
          >
            <span className="text-[#525252] mr-2">›</span>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// Minimal inline markdown renderer — handles **bold**, *italic*, `code`, and line breaks.
function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const bold = text.indexOf("**", i);
    const code = text.indexOf("`", i);
    const next = [bold, code].filter((n) => n >= 0).sort((a, b) => a - b)[0];
    if (next === undefined) {
      out.push(<span key={key++}>{text.slice(i)}</span>);
      break;
    }
    if (next > i) out.push(<span key={key++}>{text.slice(i, next)}</span>);
    if (next === bold) {
      const end = text.indexOf("**", next + 2);
      if (end === -1) {
        out.push(<span key={key++}>{text.slice(next)}</span>);
        break;
      }
      out.push(<strong key={key++} className="font-semibold text-white">{text.slice(next + 2, end)}</strong>);
      i = end + 2;
    } else {
      const end = text.indexOf("`", next + 1);
      if (end === -1) {
        out.push(<span key={key++}>{text.slice(next)}</span>);
        break;
      }
      out.push(
        <code key={key++} className="font-mono text-[12px] bg-[#171717] px-1 py-0.5 border border-[#262626] text-amber-200">
          {text.slice(next + 1, end)}
        </code>,
      );
      i = end + 1;
    }
  }
  return out;
}

function MarkdownText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <div key={i} className={line.trim().length === 0 ? "h-2" : ""}>
          {renderInline(line)}
        </div>
      ))}
    </>
  );
}

function MessageView({ message }: { message: Message }) {
  if (message.role === "user") {
    const text = typeof message.content === "string" ? message.content : "";
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-[#f0eee9] text-[#0a0a0a] px-4 py-2.5 text-[13px] leading-relaxed">
          {text}
        </div>
      </div>
    );
  }

  // Assistant: render text + tool uses + tool results
  const blocks = Array.isArray(message.content) ? message.content : [{ type: "text" as const, text: message.content }];

  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.type === "text") {
          return (
            <div key={i} className="text-[#f0eee9] text-[13px] leading-relaxed">
              <MarkdownText text={b.text} />
            </div>
          );
        }
        if (b.type === "tool_use") {
          return (
            <div key={i} className="border border-[#262626] bg-[#0f0f0f] px-3 py-2">
              <div className="flex items-center gap-2 text-[11px] text-[#a3a3a3]">
                <span className="text-amber-400">⚡</span>
                <code className="font-mono">{b.name}({summarizeInput(b.input)})</code>
              </div>
            </div>
          );
        }
        if (b.type === "tool_result") {
          const txt = typeof b.content === "string" ? b.content : JSON.stringify(b.content);
          return (
            <details key={i} className="border border-[#262626] bg-[#0f0f0f]">
              <summary className="px-3 py-2 cursor-pointer text-[11px] text-[#a3a3a3] hover:text-[#f0eee9]">
                tool result · {txt.length} chars
              </summary>
              <pre className="px-3 pb-3 text-[11px] text-[#a3a3a3] whitespace-pre-wrap overflow-x-auto max-h-[300px] overflow-y-auto">
                {txt.slice(0, 5000)}
              </pre>
            </details>
          );
        }
        return null;
      })}
    </div>
  );
}

function summarizeInput(input: any): string {
  if (!input || typeof input !== "object") return "";
  const entries = Object.entries(input);
  if (entries.length === 0) return "";
  return entries
    .map(([k, v]) => {
      const str = typeof v === "string" ? `"${v.slice(0, 30)}${v.length > 30 ? "…" : ""}"` : String(v);
      return `${k}=${str}`;
    })
    .join(", ");
}
