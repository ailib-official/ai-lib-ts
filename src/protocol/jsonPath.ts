/**
 * Minimal JSON path resolver for manifest `response_paths` / streaming paths.
 * Aligns with ai-lib-rust PathMapper dot/bracket segments (e.g. choices[0].message.content).
 */

function normalizePath(path: string): string {
  let p = path.trim();
  if (p.startsWith('$.')) p = p.slice(2);
  else if (p.startsWith('$')) p = p.slice(1);
  return p.replace(/\[/g, '.').replace(/\]/g, '');
}

export function getValueAtPath(root: unknown, path: string): unknown {
  if (root === null || root === undefined || !path.trim()) return undefined;
  let cur: unknown = root;
  const norm = normalizePath(path);
  for (const part of norm.split('.')) {
    if (part === '') continue;
    const idx = Number.parseInt(part, 10);
    if (!Number.isNaN(idx) && String(idx) === part) {
      if (!Array.isArray(cur) || idx < 0 || idx >= cur.length) return undefined;
      cur = cur[idx];
    } else if (cur !== null && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cur;
}

export function getStringAtPath(root: unknown, path: string): string | undefined {
  const v = getValueAtPath(root, path);
  if (typeof v === 'string' && v.trim() !== '') return v;
  return undefined;
}
