import type { Metadata, Viewport } from "next";
import "./globals.css";
import ReportButton from "@/components/report-button";

export const metadata: Metadata = {
  title: "Chess Coach | Game Review",
  description:
    "Analyze Chess.com games with a cleaner, more visual coaching loop: summaries, puzzles, openings, and progress tracking.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/30 selection:text-foreground">
        {children}
        <ReportButton />
      </body>
    </html>
  );
}
