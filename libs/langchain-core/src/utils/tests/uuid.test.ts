import { describe, expect, test } from "vitest";

import { v6, validate, version } from "../uuid/index.js";
import v1ToV6 from "../uuid/v1ToV6.js";

describe("uuid v6", () => {
  const v1Id = "f1207660-21d2-11ef-8c4f-419efbd44d48";
  const v6Id = "1ef21d2f-1207-6660-8c4f-419efbd44d48";

  const fullOptions = {
    msecs: 0x133b891f705,
    nsecs: 0x1538,
    clockseq: 0x385c,
    node: Uint8Array.of(0x61, 0xcd, 0x3c, 0xbb, 0x32, 0x10),
  };

  const expectedBytes = Uint8Array.of(
    0x1e,
    0x11,
    0x22,
    0xbd,
    0x94,
    0x28,
    0x68,
    0x88,
    0xb8,
    0x5c,
    0x61,
    0xcd,
    0x3c,
    0xbb,
    0x32,
    0x10
  );

  test("generates a valid v6 uuid", () => {
    const id = v6();
    expect(validate(id)).toBe(true);
    expect(version(id)).toBe(6);
  });

  test("supports all options deterministically", () => {
    const id = v6(fullOptions);
    expect(id).toBe("1e1122bd-9428-6888-b85c-61cd3cbb3210");
  });

  test("supports writing to an output buffer", () => {
    const buffer = new Uint8Array(16);
    const result = v6(fullOptions, buffer);

    expect(buffer).toEqual(expectedBytes);
    expect(result).toBe(buffer);
  });

  test("supports writing at an offset", () => {
    const buffer = new Uint8Array(32);
    v6(fullOptions, buffer, 0);
    v6(fullOptions, buffer, 16);

    const expectedBuffer = new Uint8Array(32);
    expectedBuffer.set(expectedBytes, 0);
    expectedBuffer.set(expectedBytes, 16);

    expect(buffer).toEqual(expectedBuffer);
  });

  test("throws for out-of-range buffer offsets", () => {
    const buf15 = new Uint8Array(15);
    const buf30 = new Uint8Array(30);

    expect(() => v6({}, buf15)).toThrow(RangeError);
    expect(() => v6({}, buf30, -1)).toThrow(RangeError);
    expect(() => v6({}, buf30, 15)).toThrow(RangeError);
  });

  test("converts v1 to v6 correctly", () => {
    expect(v1ToV6(v1Id)).toBe(v6Id);
  });

  test("sorts lexicographically by creation time", () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      ids.push(v6({ msecs: i * 1000 }));
    }

    expect(ids).toEqual([...ids].sort());
  });
});
