"use client";

import { useRouter } from "next/navigation";
import ResultsView from "@/components/results-view";
import type { FullAnalysisResult } from "@/lib/types";

interface ResultsClientProps {
  result: FullAnalysisResult;
  analyzedUsername?: string;
  backHref: string;
}

export default function ResultsClient({
  result,
  analyzedUsername,
  backHref,
}: ResultsClientProps) {
  const router = useRouter();
  return (
    <ResultsView
      result={result}
      analyzedUsername={analyzedUsername}
      onReset={() => router.push(backHref)}
    />
  );
}
