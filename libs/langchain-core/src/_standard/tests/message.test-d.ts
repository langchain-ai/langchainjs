import { describe, it, expectTypeOf } from "vitest";
import {
  type $MessageType,
  type $MessageToolDefinition,
  type $MessageToolSet,
  type $MessageToolCallBlock,
  type $MessageStructure,
  type $MergeMessageStructure,
  type $StandardMessageStructure,
  type $NormalizedMessageStructure,
  type $InferMessageContent,
  type $InferMessageProperties,
  type $InferMessageProperty,
  type Message,
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "../message";
import { type ContentBlock } from "../content";

describe("$MessageType", () => {
  it("should allow standard literals 'ai' | 'human' | 'system' | 'tool'", async () => {
    expectTypeOf("ai").toExtend<$MessageType>();
    expectTypeOf("human").toExtend<$MessageType>();
    expectTypeOf("system").toExtend<$MessageType>();
    expectTypeOf("tool").toExtend<$MessageType>();
  });

  it("should allow arbitrary non-null string literals (e.g., 'custom_type')", async () => {
    expectTypeOf("custom_type").toExtend<$MessageType>();

    // generic string should also be assignable
    const someString: string = "anything";
    const accept = (_t: $MessageType) => {};
    accept(someString);
  });

  it("should not allow null or undefined", async () => {
    // @ts-expect-error null is not assignable to $MessageType
    const _nullValue: $MessageType = null;
    // @ts-expect-error undefined is not assignable to $MessageType
    const _undefinedValue: $MessageType = undefined;

    expectTypeOf(null).not.toExtend<$MessageType>();
    expectTypeOf(undefined).not.toExtend<$MessageType>();
  });
});

describe("$MessageToolDefinition", () => {
  it("should require 'input' and 'output' type members", async () => {
    const ok: $MessageToolDefinition<string, number> = {
      input: "x",
      output: 1,
    };
    expectTypeOf(ok).toExtend<$MessageToolDefinition>();

    // @ts-expect-error missing 'input'
    const missingInput: $MessageToolDefinition<string, number> = {
      output: 1,
    };
    // @ts-expect-error missing 'output'
    const missingOutput: $MessageToolDefinition<string, number> = {
      input: "x",
    };
  });

  it("should default generics to unknown when unspecified", async () => {
    type Defaulted = $MessageToolDefinition;
    type Explicit = $MessageToolDefinition<unknown, unknown>;
    expectTypeOf<Defaulted>().toEqualTypeOf<Explicit>();
  });

  it("should be assignable when input/output types are extendable", async () => {
    const tool: $MessageToolDefinition<{ a: number }, string> = {
      input: { a: 1 },
      output: "ok" as const,
    };
    expectTypeOf(tool).toExtend<
      $MessageToolDefinition<{ a: number }, string>
    >();
  });

  it("should fail assignability when input/output types mismatch", async () => {
    type ExpectA = $MessageToolDefinition<{ a: number }, string>;
    type WrongInput = $MessageToolDefinition<{ a: string }, string>;
    type WrongOutput = $MessageToolDefinition<{ a: number }, number>;

    expectTypeOf<WrongInput>().not.toExtend<ExpectA>();
    expectTypeOf<WrongOutput>().not.toExtend<ExpectA>();
  });
});

describe("$MessageToolSet", () => {
  it("should map string keys to $MessageToolDefinition values", async () => {
    interface MyTools extends $MessageToolSet {
      calculator: $MessageToolDefinition<{ a: number; b: number }, number>;
    }
    const tools: MyTools = {
      calculator: { input: { a: 1, b: 2 }, output: 3 },
    };
    expectTypeOf(tools).toExtend<$MessageToolSet>();
    expectTypeOf(tools.calculator).toEqualTypeOf<
      $MessageToolDefinition<{ a: number; b: number }, number>
    >();
  });

  it("should allow multiple distinct tools with different input/output types", async () => {
    interface DistinctTools extends $MessageToolSet {
      calc: $MessageToolDefinition<{ x: number; y: number }, number>;
      translate: $MessageToolDefinition<{ text: string; to: string }, string>;
      search: $MessageToolDefinition<{ q: string }, Array<{ title: string }>>;
    }
    const tools: DistinctTools = {
      calc: { input: { x: 1, y: 2 }, output: 3 },
      translate: { input: { text: "hi", to: "es" }, output: "hola" },
      search: { input: { q: "vitest" }, output: [{ title: "Vitest" }] },
    };

    expectTypeOf(tools).toExtend<$MessageToolSet>();
    expectTypeOf(tools.calc).toEqualTypeOf<
      $MessageToolDefinition<{ x: number; y: number }, number>
    >();
    expectTypeOf(tools.translate).toEqualTypeOf<
      $MessageToolDefinition<{ text: string; to: string }, string>
    >();
    expectTypeOf(tools.search).toEqualTypeOf<
      $MessageToolDefinition<{ q: string }, Array<{ title: string }>>
    >();
  });

  it("should reject values that are not $MessageToolDefinition", async () => {
    const accept = (_: $MessageToolSet) => {};
    // @ts-expect-error values must conform to $MessageToolDefinition
    accept({ notATool: 123 });

    // @ts-expect-error missing required 'output' member
    accept({ invalid: { input: "x" } });

    // @ts-expect-error missing required 'input' member
    accept({ invalid: { output: "ok" } });
  });
});

describe("$MessageToolCallBlock<TStructure>", () => {
  it("should be never when TStructure.tools is undefined", async () => {
    interface NoTools extends $MessageStructure {}
    // should be never; any attempt to construct should error
    // @ts-expect-error cannot construct a value of type never
    const _impossible: $MessageToolCallBlock<NoTools> = {
      type: "tool_call",
      name: "x",
      args: {} as any,
    };
    expectTypeOf(_impossible).toEqualTypeOf<never>();
  });

  it("should produce a union over tool names when TStructure.tools is defined", async () => {
    interface T extends $MessageStructure {
      tools: {
        calc: $MessageToolDefinition<{ x: number; y: number }, number>;
        weather: $MessageToolDefinition<{ city: string }, string>;
      };
    }

    type Block = $MessageToolCallBlock<T>;
    type Calc = {
      readonly type: "tool_call";
      name: "calc";
      args: { x: number; y: number };
    };
    type Weather = {
      readonly type: "tool_call";
      name: "weather";
      args: { city: string };
    };

    expectTypeOf<Block>().toEqualTypeOf<Calc | Weather>();
  });

  it("should include { type: 'tool_call'; name: <tool-name>; args: <tool-input> }", async () => {
    interface T extends $MessageStructure {
      tools: {
        search: $MessageToolDefinition<{ q: string }, Array<string>>;
      };
    }
    type Block = $MessageToolCallBlock<T>;
    const ok: Block = {
      type: "tool_call",
      name: "search",
      args: { q: "x" },
    };
    expectTypeOf(ok.name).toEqualTypeOf<"search">();
    expectTypeOf(ok.args).toEqualTypeOf<{ q: string }>();
    expectTypeOf(ok.type).toEqualTypeOf<"tool_call">();
    expectTypeOf(ok).toEqualTypeOf<$MessageToolCallBlock<T>>();
  });

  it("should narrow the 'name' literal to the specific tool key", async () => {
    interface T extends $MessageStructure {
      tools: {
        calc: $MessageToolDefinition<{ x: number; y: number }, number>;
        weather: $MessageToolDefinition<{ city: string }, string>;
      };
    }
    type Block = $MessageToolCallBlock<T>;

    const goodCalc: Block = {
      type: "tool_call",
      name: "calc",
      args: { x: 1, y: 2 },
    };

    expectTypeOf<Block["name"]>().toEqualTypeOf<"calc" | "weather">();

    type WeatherBlock = Extract<Block, { name: "weather" }>;
    expectTypeOf<{ city: string }>().toExtend<WeatherBlock["args"]>();
    expectTypeOf<{ x: number }>().not.toExtend<WeatherBlock["args"]>();

    expectTypeOf(goodCalc).toExtend<Block>();
  });

  it("should make a content block that is individually addressable to each tool", async () => {
    interface T extends $MessageStructure {
      tools: {
        translate: $MessageToolDefinition<{ text: string; to: string }, string>;
        summarize: $MessageToolDefinition<{ text: string }, string>;
      };
    }
    type Block = $MessageToolCallBlock<T>;
    type TranslateOnly = Extract<Block, { name: "translate" }>;
    type SummarizeOnly = Extract<Block, { name: "summarize" }>;

    expectTypeOf<TranslateOnly>().toEqualTypeOf<{
      readonly type: "tool_call";
      name: "translate";
      args: { text: string; to: string };
    }>();
    expectTypeOf<SummarizeOnly>().toEqualTypeOf<{
      readonly type: "tool_call";
      name: "summarize";
      args: { text: string };
    }>();
  });

  it("should type 'args' as the tool's input type", async () => {
    interface T extends $MessageStructure {
      tools: {
        fetch: $MessageToolDefinition<
          { url: string; timeoutMs?: number },
          string
        >;
      };
    }
    type Block = $MessageToolCallBlock<T>;

    const ok: Block = {
      type: "tool_call",
      name: "fetch",
      args: { url: "https://example.com", timeoutMs: 1000 },
    };
    expectTypeOf(ok).toEqualTypeOf<$MessageToolCallBlock<T>>();

    type FetchArgs = Extract<Block, { name: "fetch" }>["args"];
    expectTypeOf<FetchArgs>().toEqualTypeOf<{
      url: string;
      timeoutMs?: number;
    }>();
    expectTypeOf<{ url: number }>().not.toEqualTypeOf<FetchArgs>();
    expectTypeOf<{
      url: string;
      timeoutMs?: number;
      extra: boolean;
    }>().not.toEqualTypeOf<FetchArgs>();
  });
});

describe("$MessageStructure", () => {
  it("should allow optional 'tools' as a $MessageToolSet", async () => {
    interface WithTools extends $MessageStructure {
      tools: {
        calc: $MessageToolDefinition<{ a: number; b: number }, number>;
      };
    }
    expectTypeOf<WithTools>().toExtend<$MessageStructure>();
  });

  it("should allow optional 'content' mapping $MessageType -> ContentBlock", async () => {
    interface WithContent extends $MessageStructure {
      content: {
        ai: ContentBlock.Reasoning;
        human: ContentBlock.Text;
      };
    }
    expectTypeOf<WithContent>().toExtend<$MessageStructure>();
  });

  it("should reject items in the $MessageType -> ContentBlock mapping that are not ContentBlock", async () => {
    // @ts-expect-error content values must be content blocks, not primitives
    interface WithContent extends $MessageStructure {
      content: {
        ai: 123;
        human: "foo";
      };
    }
    expectTypeOf<WithContent>().not.toExtend<$MessageStructure>();
  });

  it("should allow optional 'properties' mapping $MessageType -> Record<string, unknown>", async () => {
    interface WithProperties extends $MessageStructure {
      properties: {
        ai: { any: 1 };
        human: { foo: "bar" };
      };
    }
    expectTypeOf<WithProperties>().toExtend<$MessageStructure>();
  });

  it("should allow partial role coverage in 'content' and 'properties'", async () => {
    interface WithPartialContent extends $MessageStructure {
      content: { human: ContentBlock.Text };
    }
    interface WithPartialProperties extends $MessageStructure {
      properties: { system: Record<string, unknown> };
    }
    expectTypeOf<WithPartialContent>().toExtend<$MessageStructure>();
    expectTypeOf<WithPartialProperties>().toExtend<$MessageStructure>();
  });
});

describe("$MergeMessageStructure<T, U>", () => {
  it("should merge tools from T and U", async () => {
    interface T extends $MessageStructure {
      tools: {
        a: $MessageToolDefinition<{ x: number }, string>;
      };
    }
    interface U extends $MessageStructure {
      tools: {
        b: $MessageToolDefinition<{ y: string }, number>;
      };
    }

    type M = $MergeMessageStructure<T, U>;
    expectTypeOf<M>().toExtend<{
      tools: {
        a: {
          input: { x: number };
          output: string;
        };
        b: {
          input: { y: string };
          output: number;
        };
      };
    }>();

    type Tools = NonNullable<M["tools"]>;

    expectTypeOf<Tools["a"]>().toEqualTypeOf<
      $MessageToolDefinition<{ x: number }, string>
    >();
    expectTypeOf<Tools["b"]>().toEqualTypeOf<
      $MessageToolDefinition<{ y: string }, number>
    >();
  });

  it("should merge tools from T and U with U taking precedence on conflicts", async () => {
    interface T extends $MessageStructure {
      tools: {
        calc: $MessageToolDefinition<{ x: number }, string>;
      };
    }
    interface U extends $MessageStructure {
      tools: {
        calc: $MessageToolDefinition<{ q: string }, number>;
      };
    }

    type M = $MergeMessageStructure<T, U>;
    expectTypeOf<M>().toExtend<{
      tools: {
        calc: {
          input: { q: string };
          output: number;
        };
      };
    }>();
    expectTypeOf<M>().not.toExtend<{
      tools: {
        calc: {
          input: { q: number };
          output: string;
        };
      };
    }>();

    type Tools = NonNullable<M["tools"]>;
    expectTypeOf<Tools["calc"]>().toEqualTypeOf<
      $MessageToolDefinition<{ q: string }, number>
    >();
  });

  it("should merge content per role using discriminated-union merge when both define a role", async () => {
    interface T extends $MessageStructure {
      content: {
        human: ContentBlock.Text | ContentBlock.Reasoning;
      };
    }
    interface U extends $MessageStructure {
      content: {
        human: ContentBlock.Text | ContentBlock.Multimodal.Image;
      };
    }

    type M = $MergeMessageStructure<T, U>;
    type Human = NonNullable<M["content"]>["human"];

    expectTypeOf<Human>().toExtend<
      ContentBlock.Text | ContentBlock.Reasoning | ContentBlock.Multimodal.Image
    >();
    expectTypeOf<Human>().not.toExtend<ContentBlock.Citation>();
  });

  it("should take content from T when only T defines the role", async () => {
    interface T extends $MessageStructure {
      content: {
        system: ContentBlock.Text;
      };
    }
    interface U extends $MessageStructure {}

    type M = $MergeMessageStructure<T, U>;
    type C = M["content"];
    type HasSystem = "system" extends keyof C ? true : false;

    expectTypeOf<HasSystem>().toEqualTypeOf<true>();
    expectTypeOf<C["system"]>().toExtend<ContentBlock.Text>();
  });

  it("should take content from U when only U defines the role", async () => {
    interface T extends $MessageStructure {}
    interface U extends $MessageStructure {
      content: {
        tool: ContentBlock.Text;
      };
    }

    type M = $MergeMessageStructure<T, U>;
    type C = NonNullable<M["content"]>;
    type HasTool = "tool" extends keyof C ? true : false;

    expectTypeOf<HasTool>().toEqualTypeOf<true>();
    expectTypeOf<C["tool"]>().toExtend<ContentBlock.Text>();
  });

  it("should merge properties per role with U taking precedence on conflicts", async () => {
    interface T extends $MessageStructure {
      properties: {
        ai: { a: number; overlap: number };
      };
    }
    interface U extends $MessageStructure {
      properties: {
        ai: { b: string; overlap: string };
      };
    }

    type M = $MergeMessageStructure<T, U>;
    type AIProps = NonNullable<M["properties"]>["ai"];
    type Expected = { a: number; b: string; overlap: string };

    expectTypeOf<AIProps>().toEqualTypeOf<Expected>();
  });
});

describe("$NormalizedMessageStructure<T>", () => {
  it("should return T unchanged when T extends $StandardMessageStructure", async () => {
    type N = $NormalizedMessageStructure<$StandardMessageStructure>;
    expectTypeOf<N>().toEqualTypeOf<$StandardMessageStructure>();
  });

  it("should merge $StandardMessageStructure with T when T extends only $MessageStructure", async () => {
    interface T {
      content: {
        human: ContentBlock.Multimodal.Image;
      };
      properties: {
        ai: { usageMetadata: { extra: boolean } };
      };
    }
    type N = $NormalizedMessageStructure<T>;

    // Content should preserve standard roles and add T's additional support for human
    expectTypeOf<NonNullable<N["content"]>["human"]>().toExtend<
      ContentBlock.Text | ContentBlock.Multimodal.Image
    >();
    expectTypeOf<
      NonNullable<N["content"]>["ai"]
    >().toExtend<ContentBlock.Text>();
    expectTypeOf<NonNullable<N["content"]>["human"]>().toExtend<
      ContentBlock.Text | ContentBlock.Multimodal.Image
    >();
    expectTypeOf<
      NonNullable<N["content"]>["system"]
    >().toExtend<ContentBlock.Text>();
    expectTypeOf<
      NonNullable<N["content"]>["tool"]
    >().toExtend<ContentBlock.Text>();

    // AI properties should include standard response/usage metadata plus T's extra
    type AIProps = NonNullable<N["properties"]>["ai"];
    expectTypeOf<AIProps>().toExtend<{
      responseMetadata: { modelProvider: string; modelName: string };
      usageMetadata: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        extra: boolean;
      };
    }>();
  });

  it("should ensure standard roles exist after normalization", async () => {
    interface Minimal extends $MessageStructure {}
    type N = $NormalizedMessageStructure<Minimal>;

    // Content backfilled for all standard roles
    expectTypeOf<
      NonNullable<N["content"]>["ai"]
    >().toExtend<ContentBlock.Text>();
    expectTypeOf<
      NonNullable<N["content"]>["human"]
    >().toExtend<ContentBlock.Text>();
    expectTypeOf<
      NonNullable<N["content"]>["system"]
    >().toExtend<ContentBlock.Text>();
    expectTypeOf<
      NonNullable<N["content"]>["tool"]
    >().toExtend<ContentBlock.Text>();

    // Properties backfilled for all standard roles
    type AIP = NonNullable<N["properties"]>["ai"];
    expectTypeOf<AIP>().toEqualTypeOf<{
      responseMetadata: { modelProvider: string; modelName: string };
      usageMetadata: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      };
    }>();
    expectTypeOf<NonNullable<N["properties"]>["human"]>().toEqualTypeOf<{
      metadata: Record<string, unknown>;
    }>();
    expectTypeOf<NonNullable<N["properties"]>["system"]>().toEqualTypeOf<{
      metadata: Record<string, unknown>;
    }>();
    expectTypeOf<NonNullable<N["properties"]>["tool"]>().toEqualTypeOf<{
      metadata: Record<string, unknown>;
    }>();
  });
});

describe("$InferMessageContent<TStructure, TRole>", () => {
  it("should return the standard ContentBlock type for TRole from TStructure.content", async () => {
    interface S extends $MessageStructure {
      content: {
        ai: ContentBlock.Text | ContentBlock.Reasoning;
        human: ContentBlock.Multimodal.Image;
      };
    }

    type AI = $InferMessageContent<S, "ai">;
    type Human = $InferMessageContent<S, "human">;

    expectTypeOf<AI>().toExtend<ContentBlock.Text | ContentBlock.Reasoning>();
    expectTypeOf<Human>().toExtend<
      ContentBlock.Text | ContentBlock.Multimodal.Image
    >();
  });

  it("should include standard roles when TStructure.content is empty", async () => {
    interface S extends $MessageStructure {}
    type AI = $InferMessageContent<S, "ai">;
    type Human = $InferMessageContent<S, "human">;
    type System = $InferMessageContent<S, "system">;
    type Tool = $InferMessageContent<S, "tool">;

    expectTypeOf<AI>().toExtend<ContentBlock.Text>();
    expectTypeOf<Human>().toExtend<ContentBlock.Text>();
    expectTypeOf<System>().toExtend<ContentBlock.Text>();
    expectTypeOf<Tool>().toExtend<ContentBlock.Text>();
  });

  it("should include standard roles when TStructure.content has a non-standard role", async () => {
    interface S extends $MessageStructure {
      content: {
        foo: ContentBlock.Text;
      };
    }
    type Foo = $InferMessageContent<S, "foo">;
    expectTypeOf<Foo>().toExtend<ContentBlock.Text>();

    type AI = $InferMessageContent<S, "ai">;
    type Human = $InferMessageContent<S, "human">;
    type System = $InferMessageContent<S, "system">;
    type Tool = $InferMessageContent<S, "tool">;
    expectTypeOf<AI>().toExtend<ContentBlock.Text>();
    expectTypeOf<Human>().toExtend<ContentBlock.Text>();
    expectTypeOf<System>().toExtend<ContentBlock.Text>();
    expectTypeOf<Tool>().toExtend<ContentBlock.Text>();
  });

  it("should include standard roles when TStructure.content has standard roles", async () => {
    interface S extends $MessageStructure {
      content: {
        ai: ContentBlock.Reasoning;
      };
    }
    type AI = $InferMessageContent<S, "ai">;
    expectTypeOf<AI>().toExtend<ContentBlock.Text | ContentBlock.Reasoning>();

    type Human = $InferMessageContent<S, "human">;
    type System = $InferMessageContent<S, "system">;
    type Tool = $InferMessageContent<S, "tool">;
    expectTypeOf<Human>().toExtend<ContentBlock.Text>();
    expectTypeOf<System>().toExtend<ContentBlock.Text>();
    expectTypeOf<Tool>().toExtend<ContentBlock.Text>();
  });

  it("should include $MessageToolCallBlock<TStructure> via discriminated union when tools are present", async () => {
    interface S extends $MessageStructure {
      tools: {
        search: $MessageToolDefinition<{ q: string }, string>;
      };
      content: {
        ai: ContentBlock.Text;
      };
    }

    type AI = $InferMessageContent<S, "ai">;
    type ToolCall = Extract<AI, { type: "tool_call" }>;

    // tool_call block exists and is correctly shaped
    expectTypeOf<ToolCall>().toExtend<{
      type: "tool_call";
      name: "search";
      args: { q: string };
    }>();
  });

  it("should include properties from tool call blocks provided in the structure that are constrainted by a structures tools", async () => {
    interface S extends $MessageStructure {
      tools: {
        translate: $MessageToolDefinition<{ text: string; to: string }, string>;
        summarize: $MessageToolDefinition<{ text: string }, string>;
      };
      content: {
        ai: ContentBlock.Text;
        human: ContentBlock.Text;
      };
    }

    type AI = $InferMessageContent<S, "ai">;
    type Human = $InferMessageContent<S, "human">;

    // AI and Human content should allow tool_call variants per the tools defined
    type AITranslate = Extract<AI, { type: "tool_call"; name: "translate" }>;
    type AISummarize = Extract<AI, { type: "tool_call"; name: "summarize" }>;
    type HumanTranslate = Extract<
      Human,
      { type: "tool_call"; name: "translate" }
    >;

    expectTypeOf<AITranslate>().toExtend<{
      type: "tool_call";
      name: "translate";
      args: { text: string; to: string };
    }>();
    expectTypeOf<AISummarize>().toExtend<{
      type: "tool_call";
      name: "summarize";
      args: { text: string };
    }>();
    expectTypeOf<HumanTranslate>().toExtend<{
      type: "tool_call";
      name: "translate";
      args: { text: string; to: string };
    }>();
  });

  it("should not include tool-call types when tools are absent", async () => {
    interface S extends $MessageStructure {
      content: {
        ai: ContentBlock.Text;
      };
    }

    type AI = $InferMessageContent<S, "ai">;
    type ToolCall = Extract<AI, { type: "tool_call" }>;

    expectTypeOf<ToolCall>().toEqualTypeOf<never>();
  });

  it("should include content from a merged structure", async () => {
    interface T extends $MessageStructure {
      content: {
        ai: ContentBlock.Text;
      };
    }
    interface U extends $MessageStructure {
      content: {
        human: ContentBlock.Multimodal.Image;
      };
    }

    type M = $MergeMessageStructure<T, U>;
    type AI = $InferMessageContent<M, "ai">;
    type Human = $InferMessageContent<M, "human">;
    type System = $InferMessageContent<M, "system">;

    expectTypeOf<AI>().toExtend<ContentBlock.Text>();
    expectTypeOf<Human>().toExtend<
      ContentBlock.Text | ContentBlock.Multimodal.Image
    >();
    expectTypeOf<System>().toExtend<ContentBlock.Text>();
  });

  it("should include tool call blocks from a merged structure", async () => {
    interface T extends $MessageStructure {
      tools: {
        search: $MessageToolDefinition<{ q: string }, string>;
      };
      content: {
        ai: ContentBlock.Text;
      };
    }
    interface U extends $MessageStructure {
      tools: {
        translate: $MessageToolDefinition<{ text: string; to: string }, string>;
      };
    }

    type M = $MergeMessageStructure<T, U>;
    type AI = $InferMessageContent<M, "ai">;
    type ToolCall = Extract<AI, { type: "tool_call" }>;

    // Individual tool call types should extend the union
    expectTypeOf<{
      type: "tool_call";
      name: "search";
      args: { q: string };
    }>().toExtend<ToolCall>();
    expectTypeOf<{
      type: "tool_call";
      name: "translate";
      args: { text: string; to: string };
    }>().toExtend<ToolCall>();
  });
});

describe("$InferMessageProperties<TStructure, TRole>", () => {
  it("should return standard properties when TStructure.properties is empty", async () => {
    interface S extends $MessageStructure {}

    type AIProps = $InferMessageProperties<S, "ai">;
    expectTypeOf<AIProps>().toEqualTypeOf<{
      responseMetadata: { modelProvider: string; modelName: string };
      usageMetadata: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      };
    }>();

    type HumanProps = $InferMessageProperties<S, "human">;
    expectTypeOf<HumanProps>().toEqualTypeOf<{
      metadata: Record<string, unknown>;
    }>();

    type SystemProps = $InferMessageProperties<S, "system">;
    expectTypeOf<SystemProps>().toEqualTypeOf<{
      metadata: Record<string, unknown>;
    }>();

    type ToolProps = $InferMessageProperties<S, "tool">;
    expectTypeOf<ToolProps>().toEqualTypeOf<{
      metadata: Record<string, unknown>;
    }>();
  });

  it("should return standard properties and the properties object for TRole from TStructure.properties", async () => {
    interface S extends $MessageStructure {
      properties: {
        ai: { foo: { bar: number } };
        human: { metadata: { qux: string } };
      };
    }
    type AIProps = $InferMessageProperties<S, "ai">;
    type HumanProps = $InferMessageProperties<S, "human">;

    expectTypeOf<AIProps>().toEqualTypeOf<{
      responseMetadata: { modelProvider: string; modelName: string };
      usageMetadata: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      };
      foo: { bar: number };
    }>();
    expectTypeOf<HumanProps>().toEqualTypeOf<{
      metadata: { qux: string };
    }>();
  });

  it("should omit keys 'content' and 'type' from the result", async () => {
    interface S extends $MessageStructure {
      properties: {
        ai: {
          content: string;
          type: string;
          keep: boolean;
          nested: { a: number };
        };
      };
    }
    type AIProps = $InferMessageProperties<S, "ai">;

    expectTypeOf<AIProps>().toEqualTypeOf<{
      responseMetadata: { modelProvider: string; modelName: string };
      usageMetadata: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      };
      keep: boolean;
      nested: { a: number };
    }>();
  });

  it("should fall back to Record<string, unknown> when TRole is not present", async () => {
    interface S extends $MessageStructure {
      properties: {
        human: { some: number };
      };
    }
    type SystemProps = $InferMessageProperties<S, "foo">;

    expectTypeOf<SystemProps>().toEqualTypeOf<Record<string, unknown>>();
  });

  it("should include properties from a merged structure", async () => {
    interface T extends $MessageStructure {
      properties: {
        ai: { foo: { bar: number } };
      };
    }
    interface U extends $MessageStructure {
      properties: {
        ai: { foo: { bar: string; baz: number }; baz: { qux: string } };
      };
    }

    type M = $MergeMessageStructure<T, U>;
    type AIProps = $InferMessageProperties<M, "ai">;

    expectTypeOf<AIProps>().toEqualTypeOf<{
      responseMetadata: { modelProvider: string; modelName: string };
      usageMetadata: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
      };
      foo: { bar: string; baz: number };
      baz: { qux: string };
    }>();
  });
});

describe("$InferMessageProperty<TStructure, TRole, K>", () => {
  it("should return the property type at key K for TRole", async () => {
    interface S extends $MessageStructure {
      properties: {
        ai: { foo: { bar: number }; keep: boolean };
        human: { metadata: { note: string } };
      };
    }

    type Foo = $InferMessageProperty<S, "ai", "foo">;
    type Keep = $InferMessageProperty<S, "ai", "keep">;
    type HumanMetadata = $InferMessageProperty<S, "human", "metadata">;

    expectTypeOf<Foo>().toEqualTypeOf<{ bar: number }>();
    expectTypeOf<Keep>().toEqualTypeOf<boolean>();
    expectTypeOf<HumanMetadata>().toEqualTypeOf<{ note: string }>();
  });

  it("should be never when K is not a key of $InferMessageProperties<TStructure, TRole>", async () => {
    interface S extends $MessageStructure {
      properties: {
        ai: { foo: { bar: number } };
      };
    }

    type Missing = $InferMessageProperty<S, "ai", "doesNotExist">;
    expectTypeOf<Missing>().toEqualTypeOf<never>();
  });
});

describe("Message<TStructure, TRole>", () => {
  it("should include standard structure by default", async () => {
    type M = Message;

    // basic fields
    expectTypeOf<M["id"]>().toEqualTypeOf<string>();
    expectTypeOf<M["name"]>().toEqualTypeOf<string | undefined>();

    // type accepts at least the standard literals
    expectTypeOf<"ai">().toExtend<M["type"]>();
    expectTypeOf<"human">().toExtend<M["type"]>();
    expectTypeOf<"system">().toExtend<M["type"]>();
    expectTypeOf<"tool">().toExtend<M["type"]>();

    // default content element is Text
    type Elem = M["content"][number];
    expectTypeOf<Elem>().toExtend<ContentBlock.Text>();

    // the canonical standard-role shapes are assignable to Message
    expectTypeOf<
      | {
          id: string;
          name?: string;
          type: "ai";
          content: Array<ContentBlock.Text>;
        }
      | {
          id: string;
          name?: string;
          type: "human";
          content: Array<ContentBlock.Text>;
        }
      | {
          id: string;
          name?: string;
          type: "system";
          content: Array<ContentBlock.Text>;
        }
      | {
          id: string;
          name?: string;
          type: "tool";
          content: Array<ContentBlock.Text>;
        }
    >().toExtend<Message>();
  });

  it("should correctly infer the type of the message from the structure and role", async () => {
    interface S extends $MessageStructure {
      content: {
        ai: ContentBlock.Reasoning;
        human: ContentBlock.Multimodal.Image;
      };
    }

    type MAI = Message<S, "ai">;
    type MHuman = Message<S, "human">;

    expectTypeOf<MAI["type"]>().toEqualTypeOf<"ai">();
    expectTypeOf<MHuman["type"]>().toEqualTypeOf<"human">();

    expectTypeOf<MAI["content"][number]>().toExtend<
      $InferMessageContent<S, "ai">
    >();
    expectTypeOf<MAI["content"][number]>().not.toExtend<
      $InferMessageContent<S, "human">
    >();
    expectTypeOf<MAI["content"][number]>().toExtend<
      ContentBlock.Text | ContentBlock.Reasoning
    >();
    expectTypeOf<
      MAI["content"][number]
    >().not.toExtend<ContentBlock.Multimodal.Image>();

    expectTypeOf<MHuman["content"][number]>().toExtend<
      $InferMessageContent<S, "human">
    >();
    expectTypeOf<MHuman["content"][number]>().not.toExtend<
      $InferMessageContent<S, "ai">
    >();
    expectTypeOf<MHuman["content"][number]>().toExtend<
      ContentBlock.Text | ContentBlock.Multimodal.Image
    >();
    expectTypeOf<
      MHuman["content"][number]
    >().not.toExtend<ContentBlock.Reasoning>();
  });

  it("messages defined with custom structures should be assignable to Message", async () => {
    interface S extends $MessageStructure {
      content: {
        ai: ContentBlock.Text;
      };
    }
    expectTypeOf<Message<S>>().toExtend<Message>();
    expectTypeOf<Message<S, "ai">>().toExtend<Message>();
  });

  it("messages defined with a role should be assignable to Message", async () => {
    interface S extends $MessageStructure {
      content: {
        ai: ContentBlock.Reasoning;
      };
    }
    expectTypeOf<Message<S>>().toExtend<Message>();
    expectTypeOf<Message<S, "ai">>().toExtend<Message>();
  });
});

describe("AIMessage", () => {
  it("should be assignable to Message", async () => {
    expectTypeOf<AIMessage>().toExtend<Message>();
  });

  it("Message should not be assignable", async () => {
    expectTypeOf<Message>().not.toExtend<AIMessage>();
    expectTypeOf<{
      type: "ai";
      content: [];
      text: "";
      toolCalls: [];
    }>().not.toExtend<AIMessage>();
  });

  it("should keep standard content blocks when TStructure is provided", async () => {
    const m = new AIMessage("hello world");
    type Elem = (typeof m.content)[number];
    expectTypeOf<Elem>().toExtend<ContentBlock.Text>();
    expectTypeOf<Elem>().not.toExtend<ContentBlock.Reasoning>();
  });

  it("should keep standard content blocks when TStructure is provided", async () => {
    const m = new AIMessage<{ content: { ai: ContentBlock.Reasoning } }>(
      "hello world"
    );
    type Elem = (typeof m.content)[number];
    expectTypeOf<Elem>().toExtend<ContentBlock.Text | ContentBlock.Reasoning>();
    expectTypeOf<Elem>().not.toExtend<ContentBlock.Multimodal.Image>();
  });

  it("should be assignable to Message when TStructure is provided", async () => {
    interface S extends $MessageStructure {
      content: {
        ai: ContentBlock.Text;
      };
    }
    expectTypeOf<typeof AIMessage<S>>().instance.toExtend<Message>();
  });

  it("should be assignable to Message<$StandardMessageStructure, 'ai'>", async () => {
    expectTypeOf<typeof AIMessage>().instance.toExtend<
      Message<$MessageStructure, "ai">
    >();
  });

  it("should set readonly type to 'ai'", async () => {
    type Inst = InstanceType<typeof AIMessage>;
    expectTypeOf<Inst["type"]>().toEqualTypeOf<"ai">();
  });

  it(".responseMetadata should include standard response metadata", async () => {
    const m = new AIMessage("hello world");
    expectTypeOf<typeof m.responseMetadata>().toEqualTypeOf<
      | {
          modelProvider: string;
          modelName: string;
        }
      | undefined
    >();
  });

  it(".responseMetadata should be typed to include additional properties from the structure", async () => {
    interface S extends $MessageStructure {
      properties: {
        ai: { responseMetadata: { extra: string } };
      };
    }
    const m = new AIMessage<S>("hello world");
    expectTypeOf<typeof m.responseMetadata>().toEqualTypeOf<
      | {
          modelProvider: string;
          modelName: string;
          extra: string;
        }
      | undefined
    >();
  });

  it(".usageMetadata should be typed to include standard usage metadata", async () => {
    const m = new AIMessage("hello world");
    expectTypeOf<typeof m.usageMetadata>().toEqualTypeOf<
      | {
          inputTokens: number;
          outputTokens: number;
          totalTokens: number;
        }
      | undefined
    >();
  });

  it(".usageMetadata should be typed to include additional properties from the structure", async () => {
    interface S extends $MessageStructure {
      properties: {
        ai: { usageMetadata: { extra: string } };
      };
    }
    const m = new AIMessage<S>("hello world");
    expectTypeOf<typeof m.usageMetadata>().toEqualTypeOf<
      | {
          inputTokens: number;
          outputTokens: number;
          totalTokens: number;
          extra: string;
        }
      | undefined
    >();
  });
});

describe("HumanMessage", () => {
  it("should be assignable to Message", async () => {
    expectTypeOf<HumanMessage>().toExtend<Message>();
  });

  it("Message should not be assignable", async () => {
    expectTypeOf<Message>().not.toExtend<HumanMessage>();
    expectTypeOf<{
      type: "human";
      content: [];
      text: "";
    }>().not.toExtend<HumanMessage>();
  });

  it("should keep standard content blocks when TStructure is provided", async () => {
    const m = new HumanMessage("hello world");
    type Elem = (typeof m.content)[number];
    expectTypeOf<Elem>().toExtend<ContentBlock.Text>();
    expectTypeOf<Elem>().not.toExtend<ContentBlock.Reasoning>();
  });

  it("should keep standard content blocks when TStructure is provided", async () => {
    const m = new HumanMessage<{
      content: { human: ContentBlock.Multimodal.Image };
    }>("hello world");
    type Elem = (typeof m.content)[number];
    expectTypeOf<Elem>().toExtend<
      ContentBlock.Text | ContentBlock.Multimodal.Image
    >();
    expectTypeOf<Elem>().not.toExtend<ContentBlock.Reasoning>();
  });

  it("should be assignable to Message when TStructure is provided", async () => {
    interface S extends $MessageStructure {
      content: {
        ai: ContentBlock.Text;
      };
    }
    expectTypeOf<typeof HumanMessage<S>>().instance.toExtend<Message>();
  });

  it("should be assignable to Message<$StandardMessageStructure, 'human'>", async () => {
    expectTypeOf<typeof HumanMessage>().instance.toExtend<
      Message<$MessageStructure, "human">
    >();
  });

  it("should set readonly type to 'human'", async () => {
    type Inst = InstanceType<typeof HumanMessage>;
    expectTypeOf<Inst["type"]>().toEqualTypeOf<"human">();
  });

  it("should accept constructor(text: string) and build text content block internally", async () => {
    const m = new HumanMessage("hi there");
    type Elem = (typeof m.content)[number];
    expectTypeOf<Elem>().toExtend<ContentBlock.Text>();
  });

  it("should accept constructor(content: Array<$InferMessageContent<..., 'human'>>)", async () => {
    const m = new HumanMessage([{ type: "text", text: "hello" }]);
    type Elem = (typeof m.content)[number];
    expectTypeOf<Elem>().toExtend<ContentBlock.Text>();
  });

  it(".text getter should concatenate only text-type content blocks in order", async () => {
    type Inst = InstanceType<typeof HumanMessage>;
    expectTypeOf<Inst["text"]>().toEqualTypeOf<string>();
  });

  it(".metadata should be typed to include additional properties from the structure", async () => {
    interface S extends $MessageStructure {
      properties: {
        human: { metadata: { foo: string } };
      };
    }
    const m = new HumanMessage<S>("hello");
    expectTypeOf<typeof m.metadata>().toEqualTypeOf<
      { foo: string } | undefined
    >();
  });
});

describe("SystemMessage", () => {
  it("should be assignable to Message", async () => {
    expectTypeOf<SystemMessage>().toExtend<Message>();
  });

  it("Message should not be assignable", async () => {
    expectTypeOf<Message>().not.toExtend<SystemMessage>();
    expectTypeOf<{
      type: "system";
      content: [];
      text: "";
    }>().not.toExtend<SystemMessage>();
  });

  it("should keep standard content blocks when TStructure is provided", async () => {
    const m = new SystemMessage("hello world");
    type Elem = (typeof m.content)[number];
    expectTypeOf<Elem>().toExtend<ContentBlock.Text>();
    expectTypeOf<Elem>().not.toExtend<ContentBlock.Reasoning>();
  });

  it("should keep standard content blocks when TStructure is provided", async () => {
    const m = new SystemMessage<{
      content: { system: ContentBlock.Multimodal.Image };
    }>("hello world");
    type Elem = (typeof m.content)[number];
    expectTypeOf<Elem>().toExtend<
      ContentBlock.Text | ContentBlock.Multimodal.Image
    >();
    expectTypeOf<Elem>().not.toExtend<ContentBlock.Reasoning>();
  });

  it("should be assignable to Message when TStructure is provided", async () => {
    interface S extends $MessageStructure {
      content: {
        system: ContentBlock.Text;
      };
    }
    expectTypeOf<typeof SystemMessage<S>>().instance.toExtend<Message>();
  });

  it("should be assignable to Message<$StandardMessageStructure, 'system'>", async () => {
    expectTypeOf<typeof SystemMessage>().instance.toExtend<
      Message<$MessageStructure, "system">
    >();
  });

  it("should set readonly type to 'system'", async () => {
    type Inst = InstanceType<typeof SystemMessage>;
    expectTypeOf<Inst["type"]>().toEqualTypeOf<"system">();
  });

  it("should accept constructor(text: string) and build text content block internally", async () => {
    const m = new SystemMessage("setup context");
    type Elem = (typeof m.content)[number];
    expectTypeOf<Elem>().toExtend<ContentBlock.Text>();
  });

  it("should accept constructor(content: Array<$InferMessageContent<..., 'system'>>)", async () => {
    const m = new SystemMessage([{ type: "text", text: "policy" }]);
    type Elem = (typeof m.content)[number];
    expectTypeOf<Elem>().toExtend<ContentBlock.Text>();
  });

  it(".text getter should concatenate only text-type content blocks in order", async () => {
    type Inst = InstanceType<typeof SystemMessage>;
    expectTypeOf<Inst["text"]>().toEqualTypeOf<string>();
  });

  it(".metadata should be typed to include additional properties from the structure", async () => {
    interface S extends $MessageStructure {
      properties: {
        system: { metadata: { note: string } };
      };
    }
    const m = new SystemMessage<S>("ctx");
    expectTypeOf<typeof m.metadata>().toEqualTypeOf<
      { note: string } | undefined
    >();
  });
});

describe("ToolMessage", () => {
  it("should be assignable to Message", async () => {
    expectTypeOf<typeof ToolMessage>().instance.toExtend<Message>();
  });

  it("should be assignable to Message when TStructure is provided", async () => {
    interface S extends $MessageStructure {
      content: {
        tool: ContentBlock.Text;
      };
    }
    expectTypeOf<typeof ToolMessage<S>>().instance.toExtend<Message>();
  });

  it("should be assignable to Message<$StandardMessageStructure, 'tool'>", async () => {
    expectTypeOf<typeof ToolMessage>().instance.toExtend<
      Message<$MessageStructure, "tool">
    >();
  });

  it("should set readonly type to 'tool'", async () => {
    type Inst = InstanceType<typeof ToolMessage>;
    expectTypeOf<Inst["type"]>().toEqualTypeOf<"tool">();
  });

  it(".metadata should be typed to include additional properties from the structure", async () => {
    interface S extends $MessageStructure {
      properties: {
        tool: { metadata: { info: string } };
      };
    }
    type Inst = InstanceType<typeof ToolMessage<S>>;
    expectTypeOf<Inst["metadata"]>().toEqualTypeOf<
      { info: string } | undefined
    >();
  });

  it("with custom structure, content should reflect merged/normalized content blocks", async () => {
    interface S extends $MessageStructure {
      content: {
        tool: ContentBlock.Text | ContentBlock.Multimodal.Image;
      };
    }
    type Inst = InstanceType<typeof ToolMessage<S>>;
    type Elem = Inst["content"][number];
    expectTypeOf<Elem>().toExtend<
      ContentBlock.Text | ContentBlock.Multimodal.Image
    >();
    expectTypeOf<Elem>().not.toExtend<ContentBlock.Reasoning>();
  });
});

describe("Integration scenarios", () => {
  describe("Tooling integration via $MessageToolCallBlock", () => {
    it("AI/Human message content should allow tool_call blocks when tools exist in structure", async () => {
      interface S extends $MessageStructure {
        tools: {
          search: $MessageToolDefinition<{ q: string }, string>;
        };
      }
      const m = new AIMessage<S>("hello");
      for (const c of m.content) {
        if (c.type === "tool_call") {
          expectTypeOf<typeof c.name>().toEqualTypeOf<"search">();
          expectTypeOf<typeof c.args>().toEqualTypeOf<{ q: string }>();
          expectTypeOf<typeof c.name>().not.toEqualTypeOf<"foo">();
          expectTypeOf<typeof c.args>().not.toEqualTypeOf<{ x: number }>();
        }
      }
      const h = new HumanMessage<S>("world");
      for (const c of h.content) {
        if (c.type === "tool_call") {
          expectTypeOf<typeof c.name>().toEqualTypeOf<"search">();
          expectTypeOf<typeof c.args>().toEqualTypeOf<{ q: string }>();
          expectTypeOf<typeof c.name>().not.toEqualTypeOf<"foo">();
          expectTypeOf<typeof c.args>().not.toEqualTypeOf<{ x: number }>();
        }
      }
    });
  });
  describe("Structure merge behavior", () => {
    it("merging structures should preserve tool definitions from both sides with right precedence", async () => {
      interface T extends $MessageStructure {
        tools: {
          search: $MessageToolDefinition<{ q: string }, string>;
        };
      }
      interface U extends $MessageStructure {
        tools: {
          search: $MessageToolDefinition<{ q: string }, number>;
          weather: $MessageToolDefinition<{ city: string }, string>;
        };
      }
      type M = $MergeMessageStructure<T, U>;
      const m = new AIMessage<M>("hello");
      for (const c of m.content) {
        if (c.type === "tool_call") {
          expectTypeOf<typeof c.name>().toEqualTypeOf<"search" | "weather">();
          expectTypeOf<typeof c.args>().toEqualTypeOf<
            { q: string } | { city: string }
          >();
          expectTypeOf<typeof c.name>().not.toEqualTypeOf<"foo">();
          expectTypeOf<typeof c.args>().not.toEqualTypeOf<{ x: number }>();

          // test that narrowed tools are not assignable to other tools
          if (c.name === "search") {
            expectTypeOf<typeof c.args>().toEqualTypeOf<{ q: string }>();
          } else if (c.name === "weather") {
            expectTypeOf<typeof c.args>().toEqualTypeOf<{ city: string }>();
          }
        }
      }
    });

    it("merging structures should intersect content blocks per role using discriminated union on 'type'", async () => {
      interface T extends $MessageStructure {
        content: {
          ai: ContentBlock.Text;
        };
      }
      interface U extends $MessageStructure {
        content: {
          ai: ContentBlock.Reasoning;
        };
      }
      type M = $MergeMessageStructure<T, U>;
      const m = new AIMessage<M>("hello");
      for (const c of m.content) {
        if (c.type === "text") {
          expectTypeOf<typeof c.text>().toEqualTypeOf<string>();
        } else if (c.type === "reasoning") {
          expectTypeOf<typeof c.reasoning>().toEqualTypeOf<string>();
        } else {
          expectTypeOf<typeof c>().toEqualTypeOf<never>();
        }
      }
    });

    it("merging structures should merge properties per role with right precedence", async () => {
      interface T extends $MessageStructure {
        properties: {
          ai: { responseMetadata: { foo: string; qar: string } };
        };
      }
      interface U extends $MessageStructure {
        properties: {
          ai: { responseMetadata: { foo: number; bar: string } };
          human: { metadata: { baz: string } };
        };
      }
      type M = $MergeMessageStructure<T, U>;
      const m = new AIMessage<M>("hello");
      expectTypeOf<typeof m.responseMetadata>().toEqualTypeOf<
        | {
            modelProvider: string;
            modelName: string;
            foo: number;
            qar: string;
            bar: string;
          }
        | undefined
      >();
      const h = new HumanMessage<M>("world");
      expectTypeOf<typeof h.metadata>().toEqualTypeOf<
        | {
            baz: string;
          }
        | undefined
      >();
    });
  });
});
