import { isMessage } from "../message.js";

describe("isMessage", () => {
  describe("valid cases", () => {
    it("returns true for object with 'type' and string 'content'", () => {
      const value = { type: "ai", content: "Hello" };
      expect(isMessage(value)).toBe(true);
    });
    it("returns true for object with 'type' and array 'content'", () => {
      const blocks = [{ type: "text", text: "Hello" }];
      const value = { type: "ai", content: blocks };
      expect(isMessage(value)).toBe(true);
    });
    it("returns true for object with 'type' and empty array 'content'", () => {
      const value = { type: "ai", content: [] };
      expect(isMessage(value)).toBe(true);
    });
    it("allows additional properties beyond 'type' and 'content'", () => {
      const value = { type: "ai", content: "Hello", id: "123", extra: 42 };
      expect(isMessage(value)).toBe(true);
    });
  });

  describe("invalid cases", () => {
    it("returns false for null", () => {
      expect(isMessage(null)).toBe(false);
    });
    it("returns false for primitives (number, string, boolean, symbol, undefined)", () => {
      const values = [42, "foo", true, Symbol("s"), undefined];
      for (const v of values) {
        expect(isMessage(v)).toBe(false);
      }
    });
    it("returns false when 'type' is missing", () => {
      const value = { content: "Hello" };
      expect(isMessage(value)).toBe(false);
    });
    it("returns false when 'content' is missing", () => {
      const value = { type: "ai" };
      expect(isMessage(value)).toBe(false);
    });
    it("returns false when 'content' is neither string nor array (e.g., object/function)", () => {
      const cases = [
        { type: "ai", content: {} },
        { type: "ai", content: () => "hi" },
      ];
      for (const value of cases) {
        expect(isMessage(value)).toBe(false);
      }
    });
    it("returns false for iterable but non-array 'content' (e.g., Set/generator)", () => {
      function* gen() {
        yield { type: "text", text: "A" };
      }
      const values = [
        { type: "ai", content: new Set([{ type: "text", text: "A" }]) },
        { type: "ai", content: gen() },
      ];
      for (const value of values) {
        expect(isMessage(value)).toBe(false);
      }
    });
  });

  describe("edge cases", () => {
    it("does not enforce 'type' value shape (e.g., numeric 'type')", () => {
      const value = { type: 123, content: "Hello" };
      expect(isMessage(value)).toBe(true);
    });
    it("ignores content block shapes; only requires array-ness when not a string", () => {
      const value = { type: "ai", content: [1, 2, 3] };
      expect(isMessage(value)).toBe(true);
    });
  });
});
