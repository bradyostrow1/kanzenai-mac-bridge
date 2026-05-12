"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function DetailModal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 sm:p-10 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0d0d0d] border border-[#262626] w-full max-w-3xl shadow-2xl"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#1f1f1f]">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#525252] mb-1">detail</div>
            <h2 className="text-[#f0eee9] text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle && <div className="text-[12px] text-[#a3a3a3] mt-0.5">{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#525252] hover:text-[#f0eee9] hover:bg-[#171717] transition shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        <div className="px-5 py-2 border-t border-[#1f1f1f] text-[10px] text-[#525252] uppercase tracking-[0.18em]">
          Esc to close
        </div>
      </div>
    </div>
  );
}
