/**
 * One-shot translation script.
 *
 * Reads `messages/en.json`, calls OpenAI to produce locale variants, and
 * writes the result to `messages/es.json` and `messages/pt.json`.
 *
 * Run with:
 *   OPENAI_API_KEY=... npx tsx scripts/translate-messages.ts
 *   OPENAI_API_KEY=... npx tsx scripts/translate-messages.ts es
 *
 * Notes:
 * - We translate the entire JSON document in a single call per locale to keep
 *   tone consistent and preserve structure.
 * - ICU placeholders (e.g. `{count, plural, ...}`, `{move}`) MUST be preserved
 *   verbatim. The system prompt enforces this and we re-validate the keyset
 *   after the call.
 */

import fs from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";

interface LocaleSpec {
  code: string;
  name: string;
  notes?: string;
}

const LOCALES: LocaleSpec[] = [
  {
    code: "es",
    name: "Spanish (es-419, neutral Latin American Spanish)",
    notes:
      "Use the informal 'tu' form for the user (consistent with the English source). Keep chess terminology in Spanish but standard among ajedrecistas (e.g., 'blunder' -> 'blunder' or 'error grave' depending on context; 'mistake' -> 'error'; 'tactics' -> 'tactica'; 'king safety' -> 'seguridad del rey'; 'pawn structure' -> 'estructura de peones'; 'endgame' -> 'final'; 'opening' -> 'apertura'; 'positional' -> 'posicional'; 'time management' -> 'manejo del tiempo'; 'piece safety' -> 'seguridad de las piezas').",
  },
  {
    code: "pt",
    name: "Brazilian Portuguese (pt-BR)",
    notes:
      "Use the informal 'voce' form. Keep standard Brazilian chess terminology (e.g., 'tactics' -> 'tatica'; 'king safety' -> 'seguranca do rei'; 'pawn structure' -> 'estrutura de peoes'; 'endgame' -> 'final de jogo'; 'opening' -> 'abertura'; 'positional' -> 'posicional'; 'time management' -> 'gestao do tempo'; 'piece safety' -> 'seguranca das pecas'; 'mistake' -> 'erro'; 'blunder' -> 'erro grave').",
  },
];

const MODEL = process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-4o";

async function translateLocale(
  client: OpenAI,
  source: unknown,
  spec: LocaleSpec
): Promise<unknown> {
  const sourceJson = JSON.stringify(source, null, 2);

  const systemPrompt = `You are a professional product translator working on a chess coaching web app.
Translate the JSON document the user provides into ${spec.name}.

Rules - follow them strictly:
1. Output ONLY a JSON object. No markdown fences, no commentary.
2. Preserve the exact same keys and nesting as the source. Do NOT add, remove, or rename keys.
3. Translate ONLY the string values. Numbers, booleans, and structure stay identical.
4. ICU/MessageFormat placeholders MUST be preserved verbatim. Examples that must appear unchanged in the output:
   - {count}, {move}, {percent}, {duration}, {category}, etc.
   - Plural blocks like {count, plural, one {# game analyzed} other {# games analyzed}} - translate the inner phrases but keep the structure, the variable name, the keyword 'plural', and the '#' placeholder. Pluralization keys must stay as 'one' / 'other' (CLDR keywords) for English-style plurals; for the target locale you may use the appropriate CLDR keyword set ('one'/'other' is fine for Spanish and Portuguese).
   - Do not translate words inside backticks.
5. Keep the tone calm, direct, and practical - this is a coaching product, not marketing copy.
6. Specific guidance for this locale: ${spec.notes ?? ""}
7. The first character of the response must be '{' and the last must be '}'.`;

  const userPrompt = `Source JSON (en):\n${sourceJson}`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) {
    throw new Error(`Empty response from OpenAI for locale ${spec.code}`);
  }
  return JSON.parse(text);
}

function flatKeys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }
  const out: string[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...flatKeys(v, next));
    } else {
      out.push(next);
    }
  }
  return out;
}

function diffKeys(reference: unknown, candidate: unknown): string[] {
  const ref = new Set(flatKeys(reference));
  const cand = new Set(flatKeys(candidate));
  const missing = [...ref].filter((k) => !cand.has(k));
  const extra = [...cand].filter((k) => !ref.has(k));
  return [
    ...missing.map((k) => `missing: ${k}`),
    ...extra.map((k) => `extra: ${k}`),
  ];
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is required");
    process.exit(1);
  }

  const repoRoot = path.resolve(__dirname, "..");
  const enPath = path.join(repoRoot, "messages", "en.json");
  const enRaw = await fs.readFile(enPath, "utf8");
  const enJson = JSON.parse(enRaw);

  const requested = process.argv.slice(2);
  const targets =
    requested.length > 0
      ? LOCALES.filter((spec) => requested.includes(spec.code))
      : LOCALES;
  if (targets.length === 0) {
    console.error(
      "No matching locales requested. Usage: npx tsx scripts/translate-messages.ts [es|pt]"
    );
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  for (const spec of targets) {
    console.log(`Translating to ${spec.code} (${spec.name})...`);
    const translated = await translateLocale(client, enJson, spec);

    const diffs = diffKeys(enJson, translated);
    if (diffs.length > 0) {
      console.error(
        `Key mismatch for ${spec.code}:\n  ${diffs.join("\n  ")}\nAborting.`
      );
      process.exit(1);
    }

    const outPath = path.join(repoRoot, "messages", `${spec.code}.json`);
    await fs.writeFile(outPath, JSON.stringify(translated, null, 2) + "\n");
    console.log(`  -> wrote ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
