import { expect } from "@jest/globals";
import { HanaDB } from "../hanavector.js";

describe("Sanity check tests", () => {
  it("should sanitize int with illegal value", () => {
    try {
      HanaDB.sanitizeInt("HUGO");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      expect(error.message).toContain("must not be smaller than 0");
    }
  });

  it("should sanitize int with legal values", () => {
    expect(HanaDB.sanitizeInt(42)).toBe(42);
    expect(HanaDB.sanitizeInt("21")).toBe(21);
  });

  it("should sanitize int with negative values", () => {
    expect(HanaDB.sanitizeInt(-1, -1)).toBe(-1);
    expect(HanaDB.sanitizeInt("-1", -1)).toBe(-1);
  });

  it("should sanitize int with illegal negative value", () => {
    try {
      HanaDB.sanitizeInt(-2, -1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      expect(error.message).toContain("must not be smaller than -1");
    }
  });

  it("should parse float array from string", () => {
    const arrayAsString = "[0.1, 0.2, 0.3]";
    expect(HanaDB.parseFloatArrayFromString(arrayAsString)).toEqual([
      0.1, 0.2, 0.3,
    ]);
  });
});
