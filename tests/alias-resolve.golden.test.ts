/**
 * MULTI-ALIAS-XLANG-001 — consume ai-protocol alias-resolve golden vectors.
 * Skips when sibling ai-protocol checkout lacks the golden file.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

function protocolRoots(): string[] {
  const env = process.env.AI_PROTOCOL_ROOT;
  const here = resolve(__dirname, "..");
  return [
    env,
    join(here, "../ai-protocol"),
    join(here, "../../ai-protocol"),
    "/home/alex/ai-protocol",
  ].filter((p): p is string => Boolean(p));
}

function findProtocolFile(...rel: string[]): string | undefined {
  for (const root of protocolRoots()) {
    const p = join(root, ...rel);
    if (existsSync(p)) return p;
  }
  return undefined;
}

function canonicalFromIdentityValue(
  value: unknown,
  key: string
): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  const families = obj.families;
  if (Array.isArray(families)) {
    for (const family of families) {
      if (!family || typeof family !== "object") continue;
      const f = family as Record<string, unknown>;
      const canonical = f.canonical_id;
      if (typeof canonical !== "string") continue;
      if (key === canonical) return canonical;
      const aliases = f.aliases;
      if (Array.isArray(aliases) && aliases.some((a) => a === key)) {
        return canonical;
      }
    }
    return undefined;
  }
  const canonical = obj.canonical_id;
  if (typeof canonical !== "string") return undefined;
  if (key === canonical) return canonical;
  const aliases = obj.aliases;
  if (Array.isArray(aliases) && aliases.some((a) => a === key)) {
    return canonical;
  }
  return undefined;
}

describe("MULTI-ALIAS-XLANG-001 alias-resolve golden", () => {
  it("matches provider-identity map for every golden vector", () => {
    const goldenPath = findProtocolFile("v2", "alias-resolve.golden.json");
    const mapPath = findProtocolFile("v2", "provider-identity.fixture.json");
    if (!goldenPath || !mapPath) {
      // Protocol tip without MULTI-ALIAS golden yet — skip locally / CI until pin.
      return;
    }
    const golden = JSON.parse(readFileSync(goldenPath, "utf8"));
    const map = JSON.parse(readFileSync(mapPath, "utf8"));
    const vectors = golden.vectors as Array<{
      input: string;
      canonical: string | null;
    }>;
    expect(vectors.length).toBeGreaterThan(0);
    for (const v of vectors) {
      const got = canonicalFromIdentityValue(map, v.input) ?? null;
      const expected = v.canonical ?? null;
      expect(got, `input=${v.input}`).toBe(expected);
    }
  });
});
