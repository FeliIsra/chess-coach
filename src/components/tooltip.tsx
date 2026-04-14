"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Close on tap outside (mobile)
  const handleOutsideClick = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (
        visible &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        setVisible(false);
      }
    },
    [visible],
  );

  useEffect(() => {
    if (visible) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [visible, handleOutsideClick]);

  // Toggle on tap (mobile), show on hover (desktop)
  const handleTap = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setVisible((prev) => !prev);
  };

  return (
    <span
      ref={triggerRef}
      className="relative inline-block cursor-help"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onClick={handleTap}
    >
      <span className="border-b border-dotted border-muted">{children}</span>
      {visible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 text-xs leading-relaxed text-foreground bg-surface-1 border border-border rounded-lg shadow-lg shadow-black/30 z-50 pointer-events-none"
        >
          {content}
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-border" />
        </div>
      )}
    </span>
  );
}
