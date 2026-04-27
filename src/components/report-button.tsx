"use client";

import { useState } from "react";
import ReportDialog from "./report-dialog";

// NOTE(WT-J): label and aria-label are hard-coded English. WT-J will
// i18n-wrap once the messages files land.

export default function ReportButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report an issue"
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-4 py-2 rounded-full bg-surface-2 border border-border text-foreground text-sm font-medium shadow-lg shadow-black/30 hover:bg-surface-3 hover:border-muted transition-colors"
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        <span>Report an issue</span>
      </button>
      <ReportDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
