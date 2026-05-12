import rng from "./rng.js";
import { unsafeStringify } from "./stringify.js";
import type { UUIDTypes, Version7Options } from "./types.js";

type V7State = {
  msecs?: number; // time, milliseconds
  seq?: number; // sequence number (32-bits)
};

const _state: V7State = {};

function v7(
  options?: Version7Options,
  buf?: undefined,
  offset?: number
): string;
function v7<TBuf extends Uint8Array = Uint8Array>(
  options: Version7Options | undefined,
  buf: TBuf,
  offset?: number
): TBuf;
function v7<TBuf extends Uint8Array = Uint8Array>(
  options?: Version7Options,
  buf?: TBuf,
  offset?: number
): UUIDTypes<TBuf> {
  let bytes: Uint8Array;

  if (options) {
    // With options: Make UUID independent of internal state
    bytes = v7Bytes(
      options.random ?? options.rng?.() ?? rng(),
      options.msecs,
      options.seq,
      buf,
      offset
    );
  } else {
    // No options: Use internal state
    const now = Date.now();
    const rnds = rng();

    updateV7State(_state, now, rnds);

    bytes = v7Bytes(rnds, _state.msecs, _state.seq, buf, offset);
  }

  return buf ?? unsafeStringify(bytes);
}

// (Private!)  Do not use.  This method is only exported for testing purposes
// and may change without notice.
export function updateV7State(state: V7State, now: number, rnds: Uint8Array) {
  state.msecs ??= -Infinity;
  state.seq ??= 0;

  if (now > state.msecs) {
    // Time has moved on! Pick a new random sequence number
    state.seq = (rnds[6] << 23) | (rnds[7] << 16) | (rnds[8] << 8) | rnds[9];
    state.msecs = now;
  } else {
    // Bump sequence counter w/ 32-bit rollover
    state.seq = (state.seq + 1) | 0;

    // In case of rollover, bump timestamp to preserve monotonicity. This is
    // allowed by the RFC and should self-correct as the system clock catches
    // up. See https://www.rfc-editor.org/rfc/rfc9562.html#section-6.2-9.4
    if (state.seq === 0) {
      state.msecs++;
    }
  }

  return state;
}

function v7Bytes(
  rnds: Uint8Array,
  msecs?: number,
  seq?: number,
  buf?: Uint8Array,
  offset = 0
) {
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }

  if (!buf) {
    buf = new Uint8Array(16);
    offset = 0;
  } else {
    if (offset < 0 || offset + 16 > buf.length) {
      throw new RangeError(
        `UUID byte range ${offset}:${offset + 15} is out of buffer bounds`
      );
    }
  }

  // Defaults
  msecs ??= Date.now();
  seq ??= ((rnds[6] * 0x7f) << 24) | (rnds[7] << 16) | (rnds[8] << 8) | rnds[9];

  // byte 0-5: timestamp (48 bits)
  buf[offset++] = (msecs / 0x10000000000) & 0xff;
  buf[offset++] = (msecs / 0x100000000) & 0xff;
  buf[offset++] = (msecs / 0x1000000) & 0xff;
  buf[offset++] = (msecs / 0x10000) & 0xff;
  buf[offset++] = (msecs / 0x100) & 0xff;
  buf[offset++] = msecs & 0xff;

  // byte 6: `version` (4 bits) | sequence bits 28-31 (4 bits)
  buf[offset++] = 0x70 | ((seq >>> 28) & 0x0f);

  // byte 7: sequence bits 20-27 (8 bits)
  buf[offset++] = (seq >>> 20) & 0xff;

  // byte 8: `variant` (2 bits) | sequence bits 14-19 (6 bits)
  buf[offset++] = 0x80 | ((seq >>> 14) & 0x3f);

  // byte 9: sequence bits 6-13 (8 bits)
  buf[offset++] = (seq >>> 6) & 0xff;

  // byte 10: sequence bits 0-5 (6 bits) | random (2 bits)
  buf[offset++] = ((seq << 2) & 0xff) | (rnds[10] & 0x03);

  // bytes 11-15: random (40 bits)
  buf[offset++] = rnds[11];
  buf[offset++] = rnds[12];
  buf[offset++] = rnds[13];
  buf[offset++] = rnds[14];
  buf[offset++] = rnds[15];

  return buf;
}

export default v7;
