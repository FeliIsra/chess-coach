"use client";

import { ReactNode } from "react";

interface Props {
  id: string;
  title: string;
  summary?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}

export default function ResultsAccordionSection({
  id,
  title,
  summary,
  isOpen,
  onToggle,
  children,
  className = "",
}: Props) {
  const panelId = `${id}-panel`;
  const buttonId = `${id}-button`;

  return (
    <section className={className}>
      <div className="bg-surface-1 rounded-2xl border border-border overflow-hidden">
        <button
          id={buttonId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className="w-full px-4 py-4 text-left flex items-start justify-between gap-4"
        >
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            {summary && (
              <p className="text-sm text-muted mt-1 line-clamp-2">
                {summary}
              </p>
            )}
          </div>
          <span className="text-muted text-lg shrink-0" aria-hidden="true">
            {isOpen ? "\u2212" : "+"}
          </span>
        </button>

        {isOpen && (
          <div
            id={panelId}
            role="region"
            aria-labelledby={buttonId}
            className="px-4 pb-4 border-t border-border"
          >
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
