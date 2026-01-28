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

    it("should merge additional_kwargs when concatenating SystemMessages", () => {
      const message1 = new SystemMessage({
        content: "Hello",
        additional_kwargs: { key1: "value1", shared: "first" },
      });
      const message2 = new SystemMessage({
        content: " world",
        additional_kwargs: { key2: "value2", shared: "second" },
      });
      const result = message1.concat(message2);
      expect(result.content).toBe("Hello world");
      expect(result.additional_kwargs).toEqual({
        key1: "value1",
        key2: "value2",
        shared: "second", // Right side wins for conflicts
      });
    });

    it("should merge response_metadata when concatenating SystemMessages", () => {
      const message1 = new SystemMessage({
        content: "Hello",
        response_metadata: { source: "test1", shared: "first" },
      });
      const message2 = new SystemMessage({
        content: " world",
        response_metadata: { model: "gpt-4", shared: "second" },
      });
      const result = message1.concat(message2);
      expect(result.content).toBe("Hello world");
      expect(result.response_metadata).toEqual({
        source: "test1",
        model: "gpt-4",
        shared: "second", // Right side wins for conflicts
      });
    });

    it("should merge both additional_kwargs and response_metadata when concatenating SystemMessages", () => {
      const message1 = new SystemMessage({
        content: "Hello",
        additional_kwargs: { custom1: "value1" },
        response_metadata: { source: "test1" },
      });
      const message2 = new SystemMessage({
        content: " world",
        additional_kwargs: { custom2: "value2" },
        response_metadata: { model: "gpt-4" },
      });
      const result = message1.concat(message2);
      expect(result.content).toBe("Hello world");
      expect(result.additional_kwargs).toEqual({
        custom1: "value1",
        custom2: "value2",
      });
      expect(result.response_metadata).toEqual({
        source: "test1",
        model: "gpt-4",
      });
    });

    it("should handle empty additional_kwargs when concatenating SystemMessages", () => {
      const message1 = new SystemMessage({
        content: "Hello",
        additional_kwargs: { key1: "value1" },
      });
      const message2 = new SystemMessage({
        content: " world",
        additional_kwargs: {},
      });
      const result = message1.concat(message2);
      expect(result.additional_kwargs).toEqual({ key1: "value1" });
    });

    it("should handle empty response_metadata when concatenating SystemMessages", () => {
      const message1 = new SystemMessage({
        content: "Hello",
        response_metadata: { source: "test1" },
      });
      const message2 = new SystemMessage({
        content: " world",
        response_metadata: {},
      });
      const result = message1.concat(message2);
      expect(result.response_metadata).toEqual({ source: "test1" });
    });

    it("should handle undefined additional_kwargs when concatenating SystemMessages", () => {
      const message1 = new SystemMessage({
        content: "Hello",
        additional_kwargs: { key1: "value1" },
      });
      const message2 = new SystemMessage({
        content: " world",
      });
      const result = message1.concat(message2);
      expect(result.additional_kwargs).toEqual({ key1: "value1" });
    });

    it("should handle undefined response_metadata when concatenating SystemMessages", () => {
      const message1 = new SystemMessage({
        content: "Hello",
        response_metadata: { source: "test1" },
      });
      const message2 = new SystemMessage({
        content: " world",
      });
      const result = message1.concat(message2);
      expect(result.response_metadata).toEqual({ source: "test1" });
    });

    it("should not merge additional_kwargs when concatenating with string", () => {
      const message = new SystemMessage({
        content: "Hello",
        additional_kwargs: { key1: "value1" },
      });
      const result = message.concat(" world");
      expect(result.content).toBe("Hello world");
      expect(result.additional_kwargs).toEqual({ key1: "value1" });
    });

    it("should not merge response_metadata when concatenating with string", () => {
      const message = new SystemMessage({
        content: "Hello",
        response_metadata: { source: "test1" },
      });
      const result = message.concat(" world");
      expect(result.content).toBe("Hello world");
      expect(result.response_metadata).toEqual({ source: "test1" });
    });

    it("should merge nested additional_kwargs when concatenating SystemMessages", () => {
      const message1 = new SystemMessage({
        content: "Hello",
        additional_kwargs: {
          nested: { key1: "value1", shared: "first" },
          top: "level1",
        },
      });
      const message2 = new SystemMessage({
        content: " world",
        additional_kwargs: {
          nested: { key2: "value2", shared: "second" },
          top: "level2",
        },
      });
      const result = message1.concat(message2);
      expect(result.additional_kwargs).toEqual({
        nested: {
          key2: "value2",
          shared: "second",
        },
        top: "level2",
      });
    });

    it("should merge nested response_metadata when concatenating SystemMessages", () => {
      const message1 = new SystemMessage({
        content: "Hello",
        response_metadata: {
          nested: { source: "test1", shared: "first" },
          top: "level1",
        },
      });
      const message2 = new SystemMessage({
        content: " world",
        response_metadata: {
          nested: { model: "gpt-4", shared: "second" },
          top: "level2",
        },
      });
      const result = message1.concat(message2);
      expect(result.response_metadata).toEqual({
        nested: {
          model: "gpt-4",
          shared: "second",
        },
        top: "level2",
      });
    });

    it("should handle chained concatenations with SystemMessages preserving metadata", () => {
      const message1 = new SystemMessage({
        content: "Hello",
        additional_kwargs: { key1: "value1" },
        response_metadata: { source: "test1" },
      });
      const message2 = new SystemMessage({
        content: " ",
        additional_kwargs: { key2: "value2" },
        response_metadata: { model: "gpt-4" },
      });
      const message3 = new SystemMessage({
        content: "world",
        additional_kwargs: { key3: "value3" },
        response_metadata: { version: "1.0" },
      });
      const result = message1.concat(message2).concat(message3);
      expect(result.content).toBe("Hello world");
      expect(result.additional_kwargs).toEqual({
        key1: "value1",
        key2: "value2",
        key3: "value3",
      });
      expect(result.response_metadata).toEqual({
        source: "test1",
        model: "gpt-4",
        version: "1.0",
      });
    });

    it("should preserve original additional_kwargs and response_metadata when concatenating with string", () => {
      const message = new SystemMessage({
        content: "Hello",
        additional_kwargs: { custom: "value", nested: { key: "val" } },
        response_metadata: { source: "test", nested: { key: "val" } },
      });
      const result = message.concat(" world").concat("!");
      expect(result.additional_kwargs).toEqual({
        custom: "value",
        nested: { key: "val" },
      });
      expect(result.response_metadata).toEqual({
        source: "test",
        nested: { key: "val" },
      });
    });
  });
});
