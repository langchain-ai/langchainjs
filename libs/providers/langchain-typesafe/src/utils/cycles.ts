export function hasCircularReference(value: unknown): boolean {
  const ancestors = new WeakSet<object>();
  const visited = new WeakSet<object>();
  const visit = (current: unknown): boolean => {
    if (current === null || typeof current !== "object") return false;
    if (ancestors.has(current)) return true;
    if (visited.has(current)) return false;
    ancestors.add(current);
    for (const child of Object.values(current)) {
      if (visit(child)) return true;
    }
    ancestors.delete(current);
    visited.add(current);
    return false;
  };
  return visit(value);
}
