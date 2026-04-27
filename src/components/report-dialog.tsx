"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// NOTE(WT-J): all user-facing strings here are hard-coded English. WT-J
// owns i18n and will wrap these via the messages files later. Keep
// strings as static literals (no template concatenation) so extraction
// tooling can pick them up cleanly.

export type ReportType = "bug" | "feature" | "other";

interface Props {
  open: boolean;
  onClose: () => void;
}

const BODY_MIN = 10;
const BODY_MAX = 5000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TYPE_OPTIONS: Array<{ value: ReportType; label: string }> = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "other", label: "Other" },
];

type Status = "idle" | "submitting" | "success" | "error";

export default function ReportDialog({ open, onClose }: Props) {
  const [type, setType] = useState<ReportType>("bug");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState(""); // bot trap, see input below
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Reset form whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setType("bug");
    setBody("");
    setEmail("");
    setHoneypot("");
    setStatus("idle");
    setErrorMessage(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    // Focus body on open for keyboard users.
    requestAnimationFrame(() => bodyRef.current?.focus());
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === dialogRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  const trimmedBody = body.trim();
  const trimmedEmail = email.trim();
  const bodyLengthValid =
    trimmedBody.length >= BODY_MIN && trimmedBody.length <= BODY_MAX;
  const emailValid = trimmedEmail === "" || EMAIL_REGEX.test(trimmedEmail);
  const canSubmit =
    bodyLengthValid && emailValid && status !== "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setStatus("submitting");
    setErrorMessage(null);

    const payload = {
      type,
      body: trimmedBody,
      email: trimmedEmail || undefined,
      page_url:
        typeof window !== "undefined" ? window.location.href : undefined,
      honeypot, // sent as-is; server will silently accept-and-discard if non-empty
    };

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // navigator.userAgent is also captured server-side from the
          // request header; including it in the body would be redundant.
        },
        body: JSON.stringify(payload),
      });

      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || json.ok === false) {
        setStatus("error");
        setErrorMessage(
          json.error ??
            "Could not send your report. Please try again in a moment.",
        );
        return;
      }

      setStatus("success");
    } catch (err) {
      console.error("Report submit failed", err);
      setStatus("error");
      setErrorMessage(
        "Network error. Check your connection and try again.",
      );
    }
  }

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-dialog-title"
      onMouseDown={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 py-6"
    >
      <div className="w-full max-w-md bg-surface-1 border border-border rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2
            id="report-dialog-title"
            className="text-base font-semibold text-foreground"
          >
            Report an issue
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report dialog"
            className="text-muted hover:text-foreground transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {status === "success" ? (
          <div className="px-5 py-8 text-center">
            <div className="text-3xl mb-3" aria-hidden="true">
              ✓
            </div>
            <p className="text-foreground font-medium mb-1">
              Thanks for the report.
            </p>
            <p className="text-sm text-muted mb-5">
              We read every submission and use it to prioritize fixes.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <fieldset>
              <legend className="text-xs font-medium text-muted mb-2 uppercase tracking-wide">
                Type
              </legend>
              <div
                role="radiogroup"
                aria-label="Report type"
                className="flex gap-2"
              >
                {TYPE_OPTIONS.map((option) => {
                  const selected = option.value === type;
                  return (
                    <label
                      key={option.value}
                      className={`flex-1 cursor-pointer text-center text-sm py-2 rounded-lg border transition-colors ${
                        selected
                          ? "bg-primary border-primary text-white"
                          : "bg-surface-2 border-border text-foreground hover:border-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name="report-type"
                        value={option.value}
                        checked={selected}
                        onChange={() => setType(option.value)}
                        className="sr-only"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label
                htmlFor="report-body"
                className="block text-xs font-medium text-muted mb-2 uppercase tracking-wide"
              >
                What happened?
              </label>
              <textarea
                id="report-body"
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                minLength={BODY_MIN}
                maxLength={BODY_MAX}
                rows={5}
                placeholder="Tell us what's broken or what you'd like to see…"
                className="w-full rounded-lg bg-surface-2 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary resize-y"
              />
              <div className="mt-1 flex items-center justify-between text-xs text-muted">
                <span>
                  {trimmedBody.length < BODY_MIN
                    ? `At least ${BODY_MIN} characters`
                    : "Looks good"}
                </span>
                <span aria-live="polite">
                  {trimmedBody.length}/{BODY_MAX}
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="report-email"
                className="block text-xs font-medium text-muted mb-2 uppercase tracking-wide"
              >
                Email <span className="normal-case text-muted">(optional)</span>
              </label>
              <input
                id="report-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-lg bg-surface-2 border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
              />
              <p className="mt-1 text-xs text-muted">
                Leave blank to stay anonymous. We&apos;ll only use this to
                follow up on your report.
              </p>
              {!emailValid && (
                <p className="mt-1 text-xs text-accent-red">
                  That doesn&apos;t look like a valid email.
                </p>
              )}
            </div>

            {/*
              Honeypot field. Visually hidden and out of the tab order.
              Real users never see or fill it; naive bots will. The API
              silently discards any submission where this is non-empty.
            */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "-10000px",
                top: "auto",
                width: 1,
                height: 1,
                overflow: "hidden",
              }}
            >
              <label htmlFor="report-honeypot">
                Leave this field empty
                <input
                  id="report-honeypot"
                  type="text"
                  name="honeypot"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </label>
            </div>

            {status === "error" && errorMessage && (
              <div
                role="alert"
                className="text-sm text-accent-red bg-accent-red/10 border border-accent-red/30 rounded-lg px-3 py-2"
              >
                {errorMessage}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover disabled:bg-surface-3 disabled:text-muted disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {status === "submitting" ? "Sending…" : "Send report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
