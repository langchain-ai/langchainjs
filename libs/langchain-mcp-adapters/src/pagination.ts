/** Bound discovery even when a server repeats cursors or never ends its catalog. */
export async function collectPages<T>(
  fetchPage: (cursor?: string) => Promise<{ items: T[]; nextCursor?: string }>
): Promise<T[]> {
  const items: T[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 1000; page += 1) {
    const result = await fetchPage(cursor);
    items.push(...result.items);
    if (result.nextCursor === undefined) return items;
    if (cursors.has(result.nextCursor)) {
      throw new Error("MCP discovery returned a repeated pagination cursor");
    }
    cursors.add(result.nextCursor);
    cursor = result.nextCursor;
  }
  throw new Error("MCP discovery exceeded 1000 pages");
}
