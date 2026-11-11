const INLINE_LIMIT = 100;

function isPrimitive(value: unknown): boolean {
  return value === null || typeof value !== 'object';
}

/**
 * JSON with stable, reviewable formatting: one key per line, but short objects and
 * arrays of primitives stay on one line so diffs in data PRs stay readable.
 */
export function stringify(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every(isPrimitive)) return `[${value.map((v) => JSON.stringify(v)).join(', ')}]`;
    return `[\n${value.map((v) => padIn + stringify(v, indent + 1)).join(',\n')}\n${pad}]`;
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    if (entries.every(([, v]) => isPrimitive(v))) {
      const inline = `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(', ')} }`;
      if (inline.length <= INLINE_LIMIT) return inline;
    }
    return `{\n${entries
      .map(([k, v]) => `${padIn}${JSON.stringify(k)}: ${stringify(v, indent + 1)}`)
      .join(',\n')}\n${pad}}`;
  }

  return JSON.stringify(value);
}
