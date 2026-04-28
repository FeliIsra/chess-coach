import { describe, it, expect } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import pt from "../../messages/pt.json";

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

describe("messages bundles", () => {
  const enKeys = flatKeys(en).sort();

  it("es has the exact same keys as en", () => {
    const esKeys = flatKeys(es).sort();
    expect(esKeys).toEqual(enKeys);
  });

  it("pt has the exact same keys as en", () => {
    const ptKeys = flatKeys(pt).sort();
    expect(ptKeys).toEqual(enKeys);
  });

  it("none of the locales have placeholder/empty values", () => {
    for (const [name, bundle] of [
      ["en", en],
      ["es", es],
      ["pt", pt],
    ] as const) {
      const flat = flatKeys(bundle);
      // Walk the bundle and assert each leaf is a non-empty string.
      const visit = (val: unknown, path: string[]) => {
        if (typeof val === "string") {
          expect(val.length, `${name}:${path.join(".")} is empty`).toBeGreaterThan(0);
          return;
        }
        if (val && typeof val === "object" && !Array.isArray(val)) {
          for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
            visit(v, [...path, k]);
          }
        }
      };
      visit(bundle, []);
      expect(flat.length).toBeGreaterThan(20);
    }
  });
});
