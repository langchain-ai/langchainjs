import { describe, expect, it } from "vitest";
import { SystemMessage } from "../system.js";

describe("SystemMessage", () => {
  describe("concat", () => {
    it("should concatenate a string with string content", () => {
      const message = new SystemMessage({ content: "Hello" });
      const result = message.concat(" world");
      expect(result.content).toBe("Hello world");
      expect(result).toBeInstanceOf(SystemMessage);
      expect(result).not.toBe(message); // Should return a new instance
    });

    it("should concatenate a string with empty string content", () => {
      const message = new SystemMessage({ content: "" });
      const result = message.concat("Hello");
      expect(result.content).toBe("Hello");
    });

    it("should concatenate an empty string with string content", () => {
      const message = new SystemMessage({ content: "Hello" });
      const result = message.concat("");
      expect(result.content).toBe("Hello");
    });

    it("should concatenate two SystemMessages with string content", () => {
      const message1 = new SystemMessage({ content: "Hello" });
      const message2 = new SystemMessage({ content: " world" });
      const result = message1.concat(message2);
      expect(result.content).toBe("Hello world");
      expect(result).toBeInstanceOf(SystemMessage);
      expect(result).not.toBe(message1);
      expect(result).not.toBe(message2);
    });

    it("should concatenate SystemMessages with array content", () => {
      const message1 = new SystemMessage({
        content: [
          { type: "text", text: "Hello" },
          { type: "text", text: " there" },
        ],
      });
      const message2 = new SystemMessage({
        content: [{ type: "text", text: " world" }],
      });
      const result = message1.concat(message2);
      expect(result.content).toEqual([
        { type: "text", text: "Hello" },
        { type: "text", text: " there" },
        { type: "text", text: " world" },
      ]);
    });

    it("should concatenate string with SystemMessage containing array content", () => {
      const message1 = new SystemMessage({ content: "Hello" });
      const message2 = new SystemMessage({
        content: [{ type: "text", text: " world" }],
      });
      const result = message1.concat(message2);
      expect(result.content).toEqual([
        { type: "text", text: "Hello" },
        { type: "text", text: " world" },
      ]);
    });

    it("should concatenate SystemMessage with array content and string", () => {
      const message = new SystemMessage({
        content: [{ type: "text", text: "Hello" }],
      });
      const result = message.concat(" world");
      expect(result.content).toEqual([
        { type: "text", text: "Hello" },
        { type: "text", text: " world" },
      ]);
    });

    it("should concatenate SystemMessage with empty array content and string", () => {
      const message = new SystemMessage({ content: [] });
      const result = message.concat("Hello");
      expect(result.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("should concatenate string with SystemMessage containing empty array", () => {
      const message1 = new SystemMessage({ content: "Hello" });
      const message2 = new SystemMessage({ content: [] });
      const result = message1.concat(message2);
      expect(result.content).toBe("Hello");
    });

    it("should throw an error for unexpected chunk type", () => {
      const message = new SystemMessage({ content: "Hello" });
      expect(() => {
        // @ts-expect-error - Testing invalid input
        message.concat(123);
      }).toThrow("Unexpected chunk type for system message");
    });

    it("should throw an error for null chunk", () => {
      const message = new SystemMessage({ content: "Hello" });
      expect(() => {
        // @ts-expect-error - Testing invalid input
        message.concat(null);
      }).toThrow("Unexpected chunk type for system message");
    });

    it("should throw an error for undefined chunk", () => {
      const message = new SystemMessage({ content: "Hello" });
      expect(() => {
        // @ts-expect-error - Testing invalid input
        message.concat(undefined);
      }).toThrow("Unexpected chunk type for system message");
    });

    it("should preserve additional properties when concatenating SystemMessages", () => {
      const message1 = new SystemMessage({
        content: "Hello",
        id: "msg-1",
      });
      const message2 = new SystemMessage({
        content: " world",
        id: "msg-2",
      });
      const result = message1.concat(message2);
      // Note: concat only merges content, not other properties
      expect(result.content).toBe("Hello world");
      // The result should have message1's id (from constructor behavior)
      expect(result.id).toBe("msg-1");
    });

    it("should handle chained concatenations", () => {
      const message1 = new SystemMessage({ content: "Hello" });
      const message2 = new SystemMessage({ content: " " });
      const message3 = new SystemMessage({ content: "world" });
      const result = message1.concat(message2).concat(message3);
      expect(result.content).toBe("Hello world");
    });

    it("should handle chained concatenations with strings", () => {
      const message = new SystemMessage({ content: "Hello" });
      const result = message.concat(" ").concat("world").concat("!");
      expect(result.content).toBe("Hello world!");
    });
  });
});
