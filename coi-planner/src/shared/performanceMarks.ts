export function markStart(name: string) {
  if (typeof performance === 'undefined' || !performance.mark) return;
  performance.mark(`${name}:start`);
}

export function markEnd(name: string) {
  if (typeof performance === 'undefined' || !performance.mark || !performance.measure) return;
  const end = `${name}:end`;
  performance.mark(end);
  try {
    performance.measure(name, `${name}:start`, end);
  } catch {
    // A missing start mark is harmless in restricted or test environments.
  }
}
