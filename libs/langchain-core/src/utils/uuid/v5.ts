import sha1 from "./sha1.js";
import type { UUIDTypes } from "./types.js";
import v35, { DNS, URL } from "./v35.js";

export { DNS, URL } from "./v35.js";

function v5(
  value: string | Uint8Array,
  namespace: UUIDTypes,
  buf?: undefined,
  offset?: number
): string;
function v5<TBuf extends Uint8Array = Uint8Array>(
  value: string | Uint8Array,
  namespace: UUIDTypes,
  buf: TBuf,
  offset?: number
): TBuf;
function v5<TBuf extends Uint8Array = Uint8Array>(
  value: string | Uint8Array,
  namespace: UUIDTypes,
  buf?: TBuf,
  offset?: number
): UUIDTypes<TBuf> {
  return v35(0x50, sha1, value, namespace, buf, offset);
}

v5.DNS = DNS;
v5.URL = URL;

export default v5;
