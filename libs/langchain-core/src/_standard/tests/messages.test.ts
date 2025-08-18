import { ContentBlock } from "../content";
import {
  $MessageToolDefinition,
  AIMessage,
  HumanMessage,
  isMessage,
  isMessageTuple,
  SystemMessage,
  ToolMessage,
  convertMessageTuple,
  isMessageLike,
  convertMessageLike,
  MessageLike,
} from "../message";

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
      const values: any[] = [42, "foo", true, Symbol("s"), undefined];
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
      const cases: any[] = [
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
      const values: any[] = [
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

describe("isMessageTuple", () => {
  describe("valid cases", () => {
    it("returns true for ['ai', <string>]", () => {
      expect(isMessageTuple(["ai", "Hello"])).toBe(true);
    });
    it("returns true for ['ai', <array of content blocks>]", () => {
      const blocks = [
        { type: "text", text: "Hello" },
        { type: "text", text: "!" },
      ];
      expect(isMessageTuple(["ai", blocks])).toBe(true);
    });
    it("returns true for ['custom', <string>]", () => {
      expect(isMessageTuple(["custom", "Hello"])).toBe(true);
    });
    it("accepts iterables for the second element (e.g., Set)", () => {
      const iterable = new Set([{ type: "text", text: "A" }]);
      expect(isMessageTuple(["ai", iterable])).toBe(true);
    });
    it("accepts generator iterables for the second element", () => {
      function* gen() {
        yield { type: "text", text: "A" };
        yield { type: "text", text: "B" };
      }
      const iterable = gen();
      expect(isMessageTuple(["ai", iterable])).toBe(true);
    });
    it("accepts typed arrays and Array instances as iterables", () => {
      const typed = new Uint8Array([1, 2, 3]);
      expect(isMessageTuple(["ai", typed])).toBe(true);
      expect(isMessageTuple(["ai", [1, 2, 3]])).toBe(true);
    });
    it("accepts empty string and empty iterable values", () => {
      expect(isMessageTuple(["ai", ""])).toBe(true);
      expect(isMessageTuple(["ai", []])).toBe(true);
    });
  });

  describe("invalid cases", () => {
    it("returns false for non-array input (object/null/string/number)", () => {
      const cases: any[] = [{}, null, "foo", 123];
      for (const v of cases) {
        expect(isMessageTuple(v)).toBe(false);
      }
    });
    it("returns false for arrays with length not equal to 2", () => {
      expect(isMessageTuple([])).toBe(false);
      expect(isMessageTuple(["ai"])).toBe(false);
      expect(isMessageTuple(["ai", "hi", "extra"])).toBe(false);
    });
    it("returns false when the first element is not a string", () => {
      expect(isMessageTuple([123, "hi"])).toBe(false);
    });
    it("returns false when the second element is not a string or iterable (number/boolean/plain object)", () => {
      expect(isMessageTuple(["ai", {}])).toBe(false);
      expect(() => isMessageTuple(["ai", 123])).toThrow();
      expect(() => isMessageTuple(["ai", false])).toThrow();
    });
    it("returns false when the second element is null or undefined", () => {
      expect(() => isMessageTuple(["ai", null])).toThrow();
      expect(() => isMessageTuple(["ai", undefined])).toThrow();
    });
  });

  describe("edge cases", () => {
    it("treats boxed String objects as iterable and therefore valid", () => {
      const boxed = new String("hello");
      expect(isMessageTuple(["ai", boxed])).toBe(true);
    });
    it("treats plain objects with a [Symbol.iterator] property as valid per current behavior", () => {
      const obj = {
        [Symbol.iterator]() {
          let done = false;
          return {
            next() {
              if (done) return { done: true };
              done = true;
              return { value: { type: "text", text: "A" }, done: false };
            },
          };
        },
      };
      expect(isMessageTuple(["ai", obj])).toBe(true);
    });
  });
});

describe("convertMessageTuple", () => {
  describe("predefined roles", () => {
    it("returns an AIMessage for ['ai', <string>] and keeps string content as-is", () => {
      const result = convertMessageTuple(["ai", "Hello"]);
      expect(result).toBeInstanceOf(AIMessage);
      const m = result as AIMessage;
      expect(m.content).toEqual("Hello");
    });

    it("returns an AIMessage for ['ai', <content blocks>]", () => {
      const blocks = [
        { type: "text", text: "Hello" },
        { type: "text", text: "!" },
      ];
      const result = convertMessageTuple(["ai", blocks]);
      expect(result).toBeInstanceOf(AIMessage);
      const m = result as AIMessage;
      expect(m.content).toEqual(blocks);
    });

    it("returns a HumanMessage for ['human', <string>] and keeps string content as-is", () => {
      const result = convertMessageTuple(["human", "Hi"]);
      expect(result).toBeInstanceOf(HumanMessage);
      const m = result as HumanMessage;
      expect(m.content).toEqual("Hi");
    });

    it("returns a HumanMessage for ['human', <content blocks>]", () => {
      const blocks = [{ type: "text", text: "Hi" }];
      const result = convertMessageTuple(["human", blocks]);
      expect(result).toBeInstanceOf(HumanMessage);
      const m = result as HumanMessage;
      expect(m.content).toEqual(blocks);
    });

    it("returns a SystemMessage for ['system', <string>] and keeps string content as-is", () => {
      const result = convertMessageTuple(["system", "Config"]);
      expect(result).toBeInstanceOf(SystemMessage);
      const m = result as SystemMessage;
      expect(m.content).toEqual("Config");
    });

    it("returns a SystemMessage for ['system', <content blocks>]", () => {
      const blocks = [{ type: "text", text: "Config" }];
      const result = convertMessageTuple(["system", blocks]);
      expect(result).toBeInstanceOf(SystemMessage);
      const m = result as SystemMessage;
      expect(m.content).toEqual(blocks);
    });

    it("returns a ToolMessage for ['tool', <string>] and keeps string content as-is", () => {
      const result = convertMessageTuple(["tool", "Done"]);
      expect(result).toBeInstanceOf(ToolMessage);
      const m = result as ToolMessage;
      expect(m.content).toEqual("Done");
    });

    it("returns a ToolMessage for ['tool', <content blocks>]", () => {
      const blocks = [{ type: "text", text: "Done" }];
      const result = convertMessageTuple(["tool", blocks]);
      expect(result).toBeInstanceOf(ToolMessage);
      const m = result as ToolMessage;
      expect(m.content).toEqual(blocks);
    });
  });

  describe("custom roles", () => {
    it("returns a generic Message object with the provided role", () => {
      const result = convertMessageTuple(["custom", "Hello"])!;
      expect(result).not.toBeInstanceOf(AIMessage);
      expect(result).not.toBeInstanceOf(HumanMessage);
      expect(result).not.toBeInstanceOf(SystemMessage);
      expect(result).not.toBeInstanceOf(ToolMessage);
      expect(result.type).toBe("custom");
    });

    it("preserves an array of content blocks as-is", () => {
      const blocks = [
        { type: "text", text: "A" },
        { type: "text", text: "B" },
      ];
      const result = convertMessageTuple(["custom", blocks])!;
      expect(result.content).toEqual(blocks);
    });

    it("converts iterable content (e.g., generator/Set) to an array via Array.from", () => {
      const iterable = new Set([{ type: "text", text: "A" }]);
      const result = convertMessageTuple(["custom", iterable])!;
      expect(result.content).toEqual([{ type: "text", text: "A" }]);
      expect(Array.isArray(result.content)).toBe(true);
    });

    it("sets id to an empty string by default", () => {
      const result = convertMessageTuple(["custom", "Hello"])!;
      expect(result.id).toBe("");
    });
  });

  describe("edge cases", () => {
    it("treats unknown role casing (e.g., 'AI') as a custom role", () => {
      const result = convertMessageTuple(["AI", "Hello"])!;
      expect(result.type).toBe("AI");
      expect(result).not.toBeInstanceOf(AIMessage);
      expect(result.content).toEqual("Hello");
    });

    it("handles empty string content for predefined roles", () => {
      const ai = convertMessageTuple(["ai", ""]) as AIMessage;
      expect(ai).toBeInstanceOf(AIMessage);
      expect(ai.content).toEqual("");

      const human = convertMessageTuple(["human", ""]) as HumanMessage;
      expect(human).toBeInstanceOf(HumanMessage);
      expect(human.content).toEqual("");

      const system = convertMessageTuple(["system", ""]) as SystemMessage;
      expect(system).toBeInstanceOf(SystemMessage);
      expect(system.content).toBe("");

      const tool = convertMessageTuple(["tool", ""]) as ToolMessage;
      expect(tool).toBeInstanceOf(ToolMessage);
      expect(tool.content).toBe("");
    });

    it("handles empty arrays for content", () => {
      const blocks: any[] = [];
      const ai = convertMessageTuple(["ai", blocks]) as AIMessage;
      expect(ai.content).toEqual([]);

      const custom = convertMessageTuple(["custom", blocks])!;
      expect(custom.content).toEqual([]);
    });
  });

  describe("type guards/integration", () => {
    it("produces values that pass isMessage for all roles", () => {
      const cases: any[] = [
        ["ai", "Hello"],
        ["human", "Hello"],
        ["system", "Hello"],
        ["tool", "Hello"],
        ["custom", "Hello"],
      ];
      for (const tuple of cases) {
        const msg = convertMessageTuple(tuple);
        expect(isMessage(msg)).toBe(true);
      }
    });

    it("produces class instances for predefined roles (AIMessage, HumanMessage, SystemMessage, ToolMessage)", () => {
      expect(convertMessageTuple(["ai", "Hello"])).toBeInstanceOf(AIMessage);
      expect(convertMessageTuple(["human", "Hello"])).toBeInstanceOf(
        HumanMessage
      );
      expect(convertMessageTuple(["system", "Hello"])).toBeInstanceOf(
        SystemMessage
      );
      expect(convertMessageTuple(["tool", "Hello"])).toBeInstanceOf(
        ToolMessage
      );
    });
  });
});

describe("isMessageLike", () => {
  describe("valid cases", () => {
    it("returns true for simple string input", () => {
      expect(isMessageLike("Hello")).toBe(true);
    });
    it("returns true for Message-shaped object with 'type' and string 'content'", () => {
      const obj = { type: "ai", content: "Hello" };
      expect(isMessageLike(obj)).toBe(true);
    });
    it("returns true for Message-shaped object with 'type' and array 'content'", () => {
      const obj = { type: "ai", content: [{ type: "text", text: "Hi" }] };
      expect(isMessageLike(obj)).toBe(true);
    });
    it("returns true for tuples like ['ai', <string>]", () => {
      expect(isMessageLike(["ai", "Hello"])).toBe(true);
    });
    it("returns true for tuples like ['human', <content blocks>]", () => {
      const blocks = [{ type: "text", text: "Hi" }];
      expect(isMessageLike(["human", blocks])).toBe(true);
    });
    it("returns true for tuples with custom roles and valid second element", () => {
      expect(isMessageLike(["custom", "Hello"])).toBe(true);
    });
    it("accepts iterables as the tuple's second element (e.g., Set, generator)", () => {
      const set = new Set([{ type: "text", text: "A" }]);
      expect(isMessageLike(["ai", set])).toBe(true);
      function* gen() {
        yield { type: "text", text: "B" };
      }
      expect(isMessageLike(["ai", gen()])).toBe(true);
    });
    it("returns true for class instances (AIMessage, HumanMessage, SystemMessage, ToolMessage)", () => {
      expect(isMessageLike(new AIMessage("Hello"))).toBe(true);
      expect(isMessageLike(new HumanMessage("Hello"))).toBe(true);
      expect(isMessageLike(new SystemMessage("Hello"))).toBe(true);
      expect(isMessageLike(new ToolMessage("Hello"))).toBe(true);
    });
  });

  describe("invalid cases", () => {
    it("returns false for null", () => {
      expect(isMessageLike(null)).toBe(false);
    });
    it("returns false for primitives (number, boolean, symbol, undefined)", () => {
      const values: any[] = [42, true, Symbol("s"), undefined];
      for (const v of values) {
        expect(isMessageLike(v)).toBe(false);
      }
    });
    it("returns false for objects missing 'type' or 'content' when treated as Message", () => {
      expect(isMessageLike({ content: "Hi" })).toBe(false);
      expect(isMessageLike({ type: "ai" })).toBe(false);
    });
    it("returns false for objects with non-string/non-array 'content' (e.g., function/plain object)", () => {
      expect(isMessageLike({ type: "ai", content: {} })).toBe(false);
      expect(isMessageLike({ type: "ai", content: () => {} })).toBe(false);
    });
    it("returns false for arrays with length not equal to 2", () => {
      expect(isMessageLike([])).toBe(false);
      expect(isMessageLike(["ai"])).toBe(false);
      expect(isMessageLike(["ai", "hi", "extra"])).toBe(false);
    });
    it("throws when tuple's second element is a number or boolean; returns false for plain object", () => {
      expect(isMessageLike(["ai", {}])).toBe(false);
      expect(() => isMessageLike(["ai", 123])).toThrow();
      expect(() => isMessageLike(["ai", false])).toThrow();
    });
    it("returns false for serialized constructor objects (lc === 1) until implemented", () => {
      const serialized = {
        lc: 1,
        type: "constructor",
        id: ["langchain", "schema", "messages", "HumanMessage"],
        kwargs: { content: "Hello" },
      };
      expect(isMessageLike(serialized)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("treats boxed String objects as iterable for tuple second element", () => {
      const boxed = new String("hello");
      expect(isMessageLike(["ai", boxed])).toBe(true);
    });
    it("treats plain objects with a [Symbol.iterator] property as valid tuple second element (current behavior)", () => {
      const obj = {
        [Symbol.iterator]() {
          let done = false;
          return {
            next() {
              if (done) return { done: true };
              done = true;
              return { value: { type: "text", text: "A" }, done: false };
            },
          };
        },
      };
      expect(isMessageLike(["ai", obj])).toBe(true);
    });
    it("accepts unknown/custom role strings without restriction in tuple form", () => {
      expect(isMessageLike(["x-custom", "hi"])).toBe(true);
    });
  });
});

describe("convertMessageLike", () => {
  describe("valid cases", () => {
    it("converts a string to a HumanMessage instance", () => {
      const result = convertMessageLike("Hello");
      expect(result).toBeInstanceOf(HumanMessage);
      const m = result as HumanMessage;
      expect(m.content).toEqual([{ type: "text", text: "Hello" }]);
    });
    it("returns the same Message instance when given a Message-shaped object (identity)", () => {
      const original: MessageLike = { type: "ai", content: "Hello", id: "123" };
      const result = convertMessageLike(original);
      expect(result).toBe(original);
    });
    it("converts ['ai', <string>] to an AIMessage instance", () => {
      const result = convertMessageLike(["ai", "Hello"]);
      expect(result).toBeInstanceOf(AIMessage);
      const m = result as AIMessage;
      expect(m.content).toEqual([{ type: "text", text: "Hello" }]);
    });
    it("converts ['human', <string>] to a HumanMessage instance", () => {
      const result = convertMessageLike(["human", "Hi"]);
      expect(result).toBeInstanceOf(HumanMessage);
      const m = result as HumanMessage;
      expect(m.content).toEqual([{ type: "text", text: "Hi" }]);
    });
    it("converts ['system', <string>] to a SystemMessage instance", () => {
      const result = convertMessageLike(["system", "Config"]);
      expect(result).toBeInstanceOf(SystemMessage);
      const m = result as SystemMessage;
      expect(m.content).toEqual("Config");
    });
    it("converts ['tool', <string>] to a ToolMessage instance", () => {
      const result = convertMessageLike(["tool", "Done"]);
      expect(result).toBeInstanceOf(ToolMessage);
      const m = result as ToolMessage;
      expect(m.content).toEqual("Done");
    });
    it("converts tuples with custom roles to generic Message objects with that role", () => {
      const result = convertMessageLike(["custom", "Hello"])!;
      expect(result).not.toBeInstanceOf(AIMessage);
      expect(result.type).toBe("custom");
      // string content becomes text block array for custom roles
      expect(result.content).toEqual([{ type: "text", text: "Hello" }]);
    });
    it("converts iterable tuple content (e.g., Set/generator) to arrays via Array.from", () => {
      const set = new Set([{ type: "text", text: "A" }]);
      const result1 = convertMessageLike(["custom", set])!;
      expect(result1.content).toEqual([{ type: "text", text: "A" }]);
      expect(Array.isArray(result1.content)).toBe(true);

      function* gen() {
        yield { type: "text", text: "B" };
      }
      const result2 = convertMessageLike(["custom", gen()])!;
      expect(result2.content).toEqual([{ type: "text", text: "B" }]);
      expect(Array.isArray(result2.content)).toBe(true);
    });
  });

  describe("invalid cases", () => {
    it("returns undefined for non-MessageLike primitive inputs (number, boolean)", () => {
      const cases: any[] = [42, true];
      for (const v of cases) {
        const result = convertMessageLike(v as any);
        expect(result).toBeUndefined();
      }
    });
    it("throws for null and undefined inputs due to property access in implementation", () => {
      expect(() => convertMessageLike(null as any)).toThrow();
      expect(() => convertMessageLike(undefined as any)).toThrow();
    });
  });

  describe("error cases", () => {
    it("throws for serialized constructor objects (lc === 1) until implemented", () => {
      const serialized = {
        lc: 1,
        type: "constructor",
        id: ["langchain", "schema", "messages", "HumanMessage"],
        kwargs: { content: "Hello" },
      };
      expect(() => convertMessageLike(serialized as any)).toThrow(
        /not implemented/i
      );
    });
  });

  describe("edge cases", () => {
    it("matches predefined roles case-insensitively (e.g., 'AI' -> AIMessage)", () => {
      const result = convertMessageLike(["AI", "Hello"]);
      expect(result).toBeInstanceOf(AIMessage);
    });
    it("preserves array content as-is for custom role outputs", () => {
      const blocks = [
        { type: "text", text: "A" },
        { type: "text", text: "B" },
      ];
      const result = convertMessageLike(["custom", blocks])!;
      expect(result.content).toEqual(blocks);
    });
    it("sets id to an empty string by default for custom role outputs", () => {
      const result = convertMessageLike(["custom", "Hello"])!;
      expect(result.id).toBe("");
    });
  });

  describe("integration", () => {
    it("produces values that pass isMessage for all supported inputs", () => {
      const inputs: any[] = [
        "Hello",
        { type: "ai", content: "Hello" },
        ["ai", "Hello"],
        ["human", [{ type: "text", text: "Hi" }]],
        ["custom", new Set([{ type: "text", text: "A" }])],
      ];
      for (const input of inputs) {
        const msg = convertMessageLike(input)!;
        expect(isMessage(msg)).toBe(true);
      }
    });
    it("produces class instances for predefined roles (AIMessage, HumanMessage, SystemMessage, ToolMessage)", () => {
      expect(convertMessageLike(["ai", "Hello"])).toBeInstanceOf(AIMessage);
      expect(convertMessageLike(["human", "Hello"])).toBeInstanceOf(
        HumanMessage
      );
      expect(convertMessageLike(["system", "Hello"])).toBeInstanceOf(
        SystemMessage
      );
      expect(convertMessageLike(["tool", "Hello"])).toBeInstanceOf(ToolMessage);
    });
  });
});

describe("AIMessage", () => {
  describe("constructor", () => {
    it("can be constructed with a string", () => {
      const m = new AIMessage("Hello");
      expect(m.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("can be constructed with an array of content blocks", () => {
      const m = new AIMessage([{ type: "text", text: "Hello" }]);
      expect(m.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("cant be constructed with content blocks not defined in the standard structure", () => {
      // @ts-expect-error - "foo" is not a standard content block
      const m = new AIMessage([
        { type: "foo", url: "https://example.com/image.jpg" },
      ]);
    });

    it("can be constructed with content blocks defined in the provided structure", () => {
      interface S {
        content: {
          ai: {
            type: "foo";
            url: string;
          };
        };
      }
      const m = new AIMessage<S>([
        { type: "foo", url: "https://example.com/image.jpg" },
      ]);
      expect(m.content).toEqual([
        { type: "foo", url: "https://example.com/image.jpg" },
      ]);
    });

    it("can be constructed with params with text content", () => {
      const m = new AIMessage({ content: "Hello" });
      expect(m.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("can be constructed with params with content blocks", () => {
      const m = new AIMessage({
        content: [{ type: "text", text: "Hello" }],
      });
      expect(m.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("can be constructed with params with metadata", () => {
      const m = new AIMessage({
        content: "Hello",
        responseMetadata: {
          modelProvider: "openai",
          modelName: "gpt-4o",
        },
        usageMetadata: {
          inputTokens: 10,
          outputTokens: 20,
          totalTokens: 30,
        },
      });
      expect(m.content).toEqual([{ type: "text", text: "Hello" }]);
      expect(m.responseMetadata).toEqual({
        modelProvider: "openai",
        modelName: "gpt-4o",
      });
      expect(m.usageMetadata).toEqual({
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30,
      });
    });

    it("can be constructed with params with metadata provided in the structure", () => {
      interface S {
        properties: {
          ai: {
            responseMetadata: {
              extra: string;
            };
          };
        };
      }
      const m = new AIMessage<S>({
        content: "Hello",
        responseMetadata: {
          modelProvider: "openai",
          modelName: "gpt-4o",
          extra: "foo",
        },
      });
      expect(m.responseMetadata).toEqual({
        modelProvider: "openai",
        modelName: "gpt-4o",
        extra: "foo",
      });

      const m2 = new AIMessage<S>({
        content: [{ type: "text", text: "Hello" }],
        // @ts-expect-error - "extra" isn't provided in this constructor, but it's required in the structure
        responseMetadata: {
          modelProvider: "openai",
          modelName: "gpt-4o",
        },
      });
      expect(m2).toBeDefined();
    });
  });

  describe(".text", () => {
    it("should return text content", () => {
      const m = new AIMessage("Hello");
      expect(m.text).toEqual("Hello");
    });

    it("should return text content from content blocks", () => {
      const m = new AIMessage([
        { type: "text", text: "Hello" },
        { type: "text", text: "World" },
      ]);
      expect(m.text).toEqual("HelloWorld");
    });

    it("should not return text content from non-text content blocks", () => {
      interface S {
        content: {
          ai: ContentBlock.Multimodal.Image;
        };
      }
      const m = new AIMessage<S>([
        { type: "text", text: "Hello" },
        { type: "image", url: "https://example.com/image.jpg" },
      ]);
      expect(m.text).toEqual("Hello");
    });
  });

  describe(".toolCalls", () => {
    it("should return tool calls", () => {
      interface S {
        tools: {
          search: $MessageToolDefinition<{ q: string }, string>;
        };
      }
      const m = new AIMessage<S>([
        { type: "tool_call", name: "search", args: { q: "Hello" } },
      ]);
      expect(m.toolCalls).toEqual([
        { type: "tool_call", name: "search", args: { q: "Hello" } },
      ]);
    });

    it("should not return tool calls from non-tool content blocks", () => {
      interface S {
        content: {
          ai: ContentBlock.Multimodal.Image;
        };
      }
      const m = new AIMessage<S>([{ type: "text", text: "Hello" }]);
      expect(m.toolCalls).toEqual([]);
    });
  });

  describe("AIMessage.isInstance", () => {
    it("returns true for AIMessage instances", () => {
      expect(AIMessage.isInstance(new AIMessage("Hello"))).toBe(true);
    });
    it("returns false for non-AIMessage instances", () => {
      expect(AIMessage.isInstance(new HumanMessage("Hello"))).toBe(false);
    });
    it("returns false for non-Message instances", () => {
      expect(AIMessage.isInstance({ type: "ai", content: "Hello" })).toBe(
        false
      );
    });
  });
});

describe("HumanMessage", () => {
  describe("constructor", () => {
    it("can be constructed with a string", () => {
      const m = new HumanMessage("Hello");
      expect(m.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("can be constructed with an array of content blocks", () => {
      const m = new HumanMessage([{ type: "text", text: "Hello" }]);
      expect(m.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("can be constructed with params with text content", () => {
      const m = new HumanMessage({ content: "Hello" });
      expect(m.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("can be constructed with params with content blocks", () => {
      const m = new HumanMessage({
        content: [{ type: "text", text: "Hello" }],
      });
      expect(m.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("can be constructed with params with metadata", () => {
      const m = new HumanMessage({
        content: "Hello",
        metadata: { foo: "bar" },
      });
      expect(m.metadata).toEqual({ foo: "bar" });
    });

    it("can be constructed with params with metadata provided in the structure", () => {
      interface S {
        properties: {
          human: { metadata: { foo: string } };
        };
      }
      const m = new HumanMessage<S>({
        content: "Hello",
        metadata: { foo: "bar" },
      });
      expect(m.metadata).toEqual({ foo: "bar" });

      const m2 = new HumanMessage<S>({
        content: [{ type: "text", text: "Hello" }],
        // @ts-expect-error - "bar" isn't provided as valid metadata in the structure
        metadata: { bar: "baz" },
      });
      expect(m2).toBeDefined();
    });
  });

  describe(".text", () => {
    it("should return text content", () => {
      const m = new HumanMessage("Hello");
      expect(m.text).toEqual("Hello");
    });

    it("should return text content from content blocks", () => {
      const m = new HumanMessage([
        { type: "text", text: "Hello" },
        { type: "text", text: "World" },
      ]);
      expect(m.text).toEqual("HelloWorld");
    });

    it("should not return text content from non-text content blocks", () => {
      interface S {
        content: {
          human: ContentBlock.Multimodal.Image;
        };
      }
      const m = new HumanMessage<S>([
        { type: "text", text: "Hello" },
        { type: "image", url: "https://example.com/image.jpg" },
      ]);
      expect(m.text).toEqual("Hello");
    });
  });

  describe("HumanMessage.isInstance", () => {
    it("returns true for HumanMessage instances", () => {
      expect(HumanMessage.isInstance(new HumanMessage("Hello"))).toBe(true);
    });
    it("returns false for non-HumanMessage instances", () => {
      expect(HumanMessage.isInstance(new AIMessage("Hello"))).toBe(false);
    });
    it("returns false for non-Message instances", () => {
      expect(HumanMessage.isInstance({ type: "human", content: "Hello" })).toBe(
        false
      );
    });
  });
});

describe("SystemMessage", () => {
  describe("constructor", () => {
    it("can be constructed with a string", () => {
      const m = new SystemMessage("Hello");
      expect(m.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("can be constructed with an array of content blocks", () => {
      const m = new SystemMessage([{ type: "text", text: "Hello" }]);
      expect(m.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("can be constructed with params with text content", () => {
      const m = new SystemMessage({ content: "Hello" });
      expect(m.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("can be constructed with params with content blocks", () => {
      const m = new SystemMessage({
        content: [{ type: "text", text: "Hello" }],
      });
      expect(m.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("can be constructed with params with metadata", () => {
      const m = new SystemMessage({
        content: "Hello",
        metadata: { foo: "bar" },
      });
      expect(m.metadata).toEqual({ foo: "bar" });
    });

    it("can be constructed with params with metadata provided in the structure", () => {
      interface S {
        properties: {
          system: { metadata: { foo: string } };
        };
      }
      const m = new SystemMessage<S>({
        content: "Hello",
        metadata: { foo: "bar" },
      });
      expect(m.metadata).toEqual({ foo: "bar" });

      const m2 = new SystemMessage<S>({
        content: [{ type: "text", text: "Hello" }],
        // @ts-expect-error - "bar" isn't provided as valid metadata in the structure
        metadata: { bar: "baz" },
      });
      expect(m2).toBeDefined();
    });
  });

  describe(".text", () => {
    it("should return text content", () => {
      const m = new SystemMessage("Hello");
      expect(m.text).toEqual("Hello");
    });

    it("should return text content from content blocks", () => {
      const m = new SystemMessage([
        { type: "text", text: "Hello" },
        { type: "text", text: "World" },
      ]);
      expect(m.text).toEqual("HelloWorld");
    });

    it("should not return text content from non-text content blocks", () => {
      interface S {
        content: {
          system: ContentBlock.Multimodal.Image;
        };
      }
      const m = new SystemMessage<S>([
        { type: "text", text: "Hello" },
        { type: "image", url: "https://example.com/image.jpg" },
      ]);
      expect(m.text).toEqual("Hello");
    });
  });

  describe("SystemMessage.isInstance", () => {
    it("returns true for SystemMessage instances", () => {
      expect(SystemMessage.isInstance(new SystemMessage("Hello"))).toBe(true);
    });
    it("returns false for non-SystemMessage instances", () => {
      expect(SystemMessage.isInstance(new AIMessage("Hello"))).toBe(false);
    });
    it("returns false for non-Message instances", () => {
      expect(
        SystemMessage.isInstance({ type: "system", content: "Hello" })
      ).toBe(false);
    });
  });
});

describe("ToolMessage", () => {
  describe("constructor", () => {
    it("can be constructed with params", () => {
      const m = new ToolMessage({
        toolCallId: "call_123",
        status: "success",
        content: [{ type: "text", text: "Hello" }],
      });
      expect(m.toolCallId).toEqual("call_123");
      expect(m.status).toEqual("success");
      expect(m.content).toEqual([{ type: "text", text: "Hello" }]);
    });

    it("can be constructed with params with metadata", () => {
      const m = new ToolMessage({
        toolCallId: "call_123",
        status: "success",
        content: [{ type: "text", text: "Hello" }],
        metadata: { foo: "bar" },
      });
      expect(m.metadata).toEqual({ foo: "bar" });
    });

    it("can be constructed with params with metadata provided in the structure", () => {
      interface S {
        properties: {
          tool: { metadata: { foo: string } };
        };
      }
      const m = new ToolMessage<S>({
        toolCallId: "call_123",
        status: "success",
        content: "Hello",
        metadata: { foo: "bar" },
      });
      expect(m.metadata).toEqual({ foo: "bar" });

      const m2 = new ToolMessage<S>({
        toolCallId: "call_123",
        status: "success",
        content: [{ type: "text", text: "Hello" }],
        // @ts-expect-error - "bar" isn't provided as valid metadata in the structure
        metadata: { bar: "baz" },
      });
      expect(m2).toBeDefined();
    });
  });

  describe(".result", () => {
    it("should return text content", () => {
      const m = new ToolMessage({
        toolCallId: "call_123",
        status: "success",
        content: [
          { type: "text", text: "Hello" },
          { type: "text", text: "World" },
        ],
      });
      expect(m.result).toEqual("HelloWorld");
    });

    it("should not return text content from non-text content blocks", () => {
      interface S {
        content: {
          tool: ContentBlock.Multimodal.Image;
        };
      }
      const m = new ToolMessage<S>({
        toolCallId: "call_123",
        status: "success",
        content: [{ type: "image", url: "https://example.com/image.jpg" }],
      });
      expect(m.result).toEqual("");
    });
  });

  describe("ToolMessage.isInstance", () => {
    it("returns true for ToolMessage instances", () => {
      expect(ToolMessage.isInstance(new ToolMessage("Hello"))).toBe(true);
    });
    it("returns false for non-ToolMessage instances", () => {
      expect(ToolMessage.isInstance(new AIMessage("Hello"))).toBe(false);
    });
    it("returns false for non-Message instances", () => {
      expect(ToolMessage.isInstance({ type: "tool", content: "Hello" })).toBe(
        false
      );
    });
  });
});
