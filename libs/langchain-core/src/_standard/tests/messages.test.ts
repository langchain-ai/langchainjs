import { ContentBlock } from "../content";
import {
  $MessageToolDefinition,
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "../message";

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

      // @ts-expect-error - "extra" isn't provided in this constructor, but it's required in the structure
      const m2 = new AIMessage<S>({
        content: "Hello",
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

      // @ts-expect-error - "bar" isn't provided as valid metadata in the structure
      const m2 = new HumanMessage<S>({
        content: "Hello",
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

      // @ts-expect-error - "bar" isn't provided as valid metadata in the structure
      const m2 = new SystemMessage<S>({
        content: "Hello",
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
        content: [{ type: "text", text: "Hello" }],
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
});
