export function getTypedSlice(text, elapsed, startMs, typeDurationMs) {
  if (elapsed < startMs) return "";
  if (elapsed >= startMs + typeDurationMs) return text;
  const progress = (elapsed - startMs) / typeDurationMs;
  const chars = Math.max(0, Math.floor(progress * text.length));
  return text.slice(0, chars);
}

export function inWindow(elapsed, startMs, endMs) {
  return elapsed >= startMs && elapsed < endMs;
}

export function smoothstep(edge0, edge1, x) {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function cycleEdgeOpacity(elapsed, cycleMs, fadeInMs, fadeOutMs) {
  return smoothstep(0, fadeInMs, elapsed) * (1 - smoothstep(cycleMs - fadeOutMs, cycleMs, elapsed));
}

