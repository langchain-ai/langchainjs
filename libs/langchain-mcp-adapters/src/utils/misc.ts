export const iife = <T>(fn: () => T): T => fn();

/**
 * Headers, spelled the way the MCP SDK spells the ones it sets itself.
 *
 * A transport builds its request headers as
 * `new Headers({ Authorization, ...ours })` — a case-sensitive spread over a
 * case-insensitive namespace. A header of ours differing only in case
 * survives that spread as a *second* key and the `Headers` constructor
 * appends, so an `Authorization` configured beside an `authProvider` reached
 * the wire as `Bearer <provider>, Bearer <ours>`, which a server rejects.
 *
 * Canonicalising as they are parsed means every header the adapter holds is
 * already spelled the SDK's way, so nothing downstream has to remember — a
 * connection reaches a transport through several paths and only some of them
 * merge. `Authorization` is the only name affected: the SDK spells everything
 * else it sets in lower case, where any case of ours already replaces
 * cleanly. A future capitalised SDK header would be added here.
 */
export const getSdkHeaderCase = (
  headers: Record<string, string>
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name.toLowerCase() === "authorization" ? "Authorization" : name,
      value,
    ])
  );

/**
 * A utility function that serializes the headers object to a string
 * and orders the keys alphabetically so that the same headers object
 * will always produce the same string.
 * @param headers - The headers object to serialize
 * @returns The serialized headers object
 */
export function serializeHeaders(
  headers?: Record<string, string>
): string | undefined {
  if (!headers || Object.keys(headers).length === 0) {
    return;
  }

  return JSON.stringify([...new Headers(headers)]);
}

/**
 * Merge header sets; later sources win.
 *
 * `Headers` deduplicates case-insensitively, which also lower-cases, so the
 * result is respelled with {@link getSdkHeaderCase} — a merge produces headers
 * that never passed through the connection schema.
 */
export function mergeHeaders(
  base: Record<string, string> | undefined,
  overrides: Record<string, string> | undefined
): Record<string, string> {
  const headers = new Headers(base);

  for (const [name, value] of Object.entries(overrides ?? {}))
    headers.set(name, value);

  return getSdkHeaderCase(Object.fromEntries(headers));
}
