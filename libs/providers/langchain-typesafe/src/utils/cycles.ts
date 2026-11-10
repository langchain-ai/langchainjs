// From `zod/v4/core`: `zod/v4` re-exports `util` only from 4.2.
import { util } from "zod/v4/core";

/**
 * Whether `value` holds a reference to one of its own ancestors, the shape
 * `JSON.stringify` rejects. The same object reached through two siblings
 * is not a cycle.
 *
 * Descends only where `z.array` and `z.record` do, so a class instance
 * such as a message is a leaf. zod 4.5 and later copy a cycle into the
 * parsed output instead of overflowing the stack on it, so a schema parse
 * cannot be relied on to reject one.
 */
export function isCyclic(value: unknown): boolean {
  const ancestors = new Set<object>();
  const visit = (node: unknown): boolean => {
    if (!Array.isArray(node) && !util.isPlainObject(node)) {
      return false;
    }
    if (ancestors.has(node)) {
      return true;
    }
    ancestors.add(node);
    const cyclic = Object.values(node).some(visit);
    ancestors.delete(node);
    return cyclic;
  };
  return visit(value);
}
