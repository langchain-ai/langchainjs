import { describe, it, expectTypeOf } from "vitest";
import {
  MessageType,
  MessageToolDefinition,
  MessageToolSet,
  $MessageToolCallBlock,
  MessageStructure,
  MessageOutputVersion,
  $NormalizedMessageStructure,
  StandardMessageStructure,
  $MergeOutputVersion,
  $MergeMessageStructure,
  Message,
  $InferMessageContentBlocks,
  $InferMessageProperty,
  $InferMessageProperties,
  $InferResponseMetadata,
  $InferToolCalls,
  $InferToolOutputs,
} from "../message.js";
import { ContentBlock } from "../content/index.js";
import { ResponseMetadata, UsageMetadata } from "../metadata.js";
import { AIMessage } from "../ai.js";
import { HumanMessage } from "../human.js";
import { ToolMessage } from "../tool.js";
import { SystemMessage } from "../system.js";

describe("MessageType", () => {
  it("should allow standard literals 'ai' | 'human' | 'system' | 'tool'", async () => {
    expectTypeOf("ai").toExtend<MessageType>();
    expectTypeOf("human").toExtend<MessageType>();
    expectTypeOf("system").toExtend<MessageType>();
    expectTypeOf("tool").toExtend<MessageType>();
  });

  it("should allow arbitrary non-null string literals (e.g., 'custom_type')", async () => {
    expectTypeOf("custom_type").toExtend<MessageType>();

    // generic string should also be assignable
    const someString = "anything";
    const accept = (_t: MessageType) => {};
    accept(someString);
  });

  it("should not allow null or undefined", async () => {
    // @ts-expect-error null is not assignable to MessageType
    const _nullValue: MessageType = null;
    // @ts-expect-error undefined is not assignable to MessageType
    const _undefinedValue: MessageType = undefined;

    expectTypeOf(null).not.toExtend<MessageType>();
    expectTypeOf(undefined).not.toExtend<MessageType>();
  });
});

describe("MessageToolDefinition", () => {
  it("should require 'input' and 'output' type members", async () => {
    const ok: MessageToolDefinition<string, number> = {
      input: "x",
      output: 1,
    };
    expectTypeOf(ok).toExtend<MessageToolDefinition>();

    // @ts-expect-error missing 'input'
    const _missingInput: MessageToolDefinition<string, number> = {
      output: 1,
    };
    // @ts-expect-error missing 'output'
    const _missingOutput: MessageToolDefinition<string, number> = {
      input: "x",
    };
  });

  it("should default generics to unknown when unspecified", async () => {
    type Defaulted = MessageToolDefinition;
    type Explicit = MessageToolDefinition<unknown, unknown>;
    expectTypeOf<Defaulted>().toEqualTypeOf<Explicit>();
  });

  it("should be assignable when input/output types are extendable", async () => {
    const tool: MessageToolDefinition<{ a: number }, string> = {
      input: { a: 1 },
      output: "ok" as const,
    };
    expectTypeOf(tool).toExtend<MessageToolDefinition<{ a: number }, string>>();
  });

  it("should fail assignability when input/output types mismatch", async () => {
    type ExpectA = MessageToolDefinition<{ a: number }, string>;
    type WrongInput = MessageToolDefinition<{ a: string }, string>;
    type WrongOutput = MessageToolDefinition<{ a: number }, number>;

    expectTypeOf<WrongInput>().not.toExtend<ExpectA>();
    expectTypeOf<WrongOutput>().not.toExtend<ExpectA>();
  });
});

describe("MessageToolSet", () => {
  it("should map string keys to MessageToolDefinition values", async () => {
    interface MyTools extends MessageToolSet {
      calculator: MessageToolDefinition<{ a: number; b: number }, number>;
    }
    const tools: MyTools = {
      calculator: { input: { a: 1, b: 2 }, output: 3 },
    };
    expectTypeOf(tools).toExtend<MessageToolSet>();
    expectTypeOf(tools.calculator).toEqualTypeOf<
      MessageToolDefinition<{ a: number; b: number }, number>
    >();
  });

  it("should allow multiple distinct tools with different input/output types", async () => {
    interface DistinctTools extends MessageToolSet {
      calc: MessageToolDefinition<{ x: number; y: number }, number>;
      translate: MessageToolDefinition<{ text: string; to: string }, string>;
      search: MessageToolDefinition<{ q: string }, Array<{ title: string }>>;
    }
    const tools: DistinctTools = {
      calc: { input: { x: 1, y: 2 }, output: 3 },
      translate: { input: { text: "hi", to: "es" }, output: "hola" },
      search: { input: { q: "vitest" }, output: [{ title: "Vitest" }] },
    };

    expectTypeOf(tools).toExtend<MessageToolSet>();
    expectTypeOf(tools.calc).toEqualTypeOf<
      MessageToolDefinition<{ x: number; y: number }, number>
    >();
    expectTypeOf(tools.translate).toEqualTypeOf<
      MessageToolDefinition<{ text: string; to: string }, string>
    >();
    expectTypeOf(tools.search).toEqualTypeOf<
      MessageToolDefinition<{ q: string }, Array<{ title: string }>>
    >();
  });

  it("should reject values that are not MessageToolDefinition", async () => {
    const accept = (_: MessageToolSet) => {};
    // @ts-expect-error values must conform to MessageToolDefinition
    accept({ notATool: 123 });

    // @ts-expect-error missing required 'output' member
    accept({ invalid: { input: "x" } });

    // @ts-expect-error missing required 'input' member
    accept({ invalid: { output: "ok" } });
  });
});

describe("$MessageToolCallBlock<TStructure>", () => {
  it("should be never when TStructure.tools is undefined", async () => {
    // should be never; any attempt to construct should error
    // @ts-expect-error cannot construct a value of type never
    const _impossible: $MessageToolCallBlock<MessageStructure> = {
      type: "tool_call",
      name: "x",
      args: {},
    };
    expectTypeOf(_impossible).toEqualTypeOf<never>();
  });

  it("should produce a union over tool names when TStructure.tools is defined", async () => {
    interface T extends MessageStructure {
      tools: {
        calc: MessageToolDefinition<{ x: number; y: number }, number>;
        weather: MessageToolDefinition<{ city: string }, string>;
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
    expectTypeOf<Block>().toExtend<Calc | Weather>();

    type CalcA = ContentBlock.Tools.ToolCall<"calc", { x: number; y: number }>;
    type WeatherA = ContentBlock.Tools.ToolCall<"weather", { city: string }>;
    expectTypeOf<Block>().toExtend<CalcA | WeatherA>();
  });

  it("should include { type: 'tool_call'; name: <tool-name>; args: <tool-input> }", async () => {
    interface T extends MessageStructure {
      tools: {
        search: MessageToolDefinition<{ q: string }, Array<string>>;
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
    interface T extends MessageStructure {
      tools: {
        calc: MessageToolDefinition<{ x: number; y: number }, number>;
        weather: MessageToolDefinition<{ city: string }, string>;
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
    interface T extends MessageStructure {
      tools: {
        translate: MessageToolDefinition<{ text: string; to: string }, string>;
        summarize: MessageToolDefinition<{ text: string }, string>;
      };
    }
    type Block = $MessageToolCallBlock<T>;
    type TranslateOnly = Extract<Block, { name: "translate" }>;
    type SummarizeOnly = Extract<Block, { name: "summarize" }>;

    expectTypeOf<TranslateOnly>().toExtend<{
      readonly type: "tool_call";
      name: "translate";
      args: { text: string; to: string };
    }>();
    expectTypeOf<SummarizeOnly>().toExtend<{
      readonly type: "tool_call";
      name: "summarize";
      args: { text: string };
    }>();
  });

  it("should type 'args' as the tool's input type", async () => {
    interface T extends MessageStructure {
      tools: {
        fetch: MessageToolDefinition<
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

describe("MessageStructure", () => {
  it("should allow optional 'outputVersion' as a MessageOutputVersion", async () => {
    interface WithOutputVersionA extends MessageStructure {
      outputVersion: MessageOutputVersion;
    }
    expectTypeOf<WithOutputVersionA>().toExtend<MessageStructure>();

    interface WithOutputVersionB extends MessageStructure {
      outputVersion: "v0";
    }
    expectTypeOf<WithOutputVersionB>().toExtend<MessageStructure>();

    interface WithOutputVersionC extends MessageStructure {
      outputVersion: "v1";
    }
    expectTypeOf<WithOutputVersionC>().toExtend<MessageStructure>();
  });

  it("should allow optional 'tools' as a MessageToolSet", async () => {
    interface WithTools extends MessageStructure {
      tools: {
        calc: MessageToolDefinition<{ a: number; b: number }, number>;
      };
    }
    expectTypeOf<WithTools>().toExtend<MessageStructure>();
  });

  it("should allow optional 'content' mapping MessageType -> ContentBlock", async () => {
    interface WithContent extends MessageStructure {
      content: {
        ai: ContentBlock.Reasoning;
        human: ContentBlock.Text;
      };
    }
    expectTypeOf<WithContent>().toExtend<MessageStructure>();
  });

  it("should reject items in the MessageType -> ContentBlock mapping that are not ContentBlock", async () => {
    // @ts-expect-error content values must be content blocks, not primitives
    interface WithContent extends MessageStructure {
      content: {
        ai: 123;
        human: "foo";
      };
    }
    expectTypeOf<WithContent>().not.toExtend<MessageStructure>();
  });

  it("should allow optional 'properties' mapping MessageType -> Record<string, unknown>", async () => {
    interface WithProperties extends MessageStructure {
      properties: {
        ai: { any: 1 };
        human: { foo: "bar" };
      };
    }
    expectTypeOf<WithProperties>().toExtend<MessageStructure>();
  });

  it("should allow partial role coverage in 'content' and 'properties'", async () => {
    interface WithPartialContent extends MessageStructure {
      content: { human: ContentBlock.Text };
    }
    interface WithPartialProperties extends MessageStructure {
      properties: { system: Record<string, unknown> };
    }
    expectTypeOf<WithPartialContent>().toExtend<MessageStructure>();
    expectTypeOf<WithPartialProperties>().toExtend<MessageStructure>();
  });
});

describe("$MergeOutputVersion<T, U>", () => {
  it("should default to 'v0' when both are undefined", async () => {
    expectTypeOf<
      $MergeOutputVersion<undefined, undefined>
    >().toEqualTypeOf<"v0">();

    // normalization to undefined on both sides should also result in "v0"
    expectTypeOf<$MergeOutputVersion<unknown, unknown>>().toEqualTypeOf<"v0">();
    expectTypeOf<$MergeOutputVersion<string, number>>().toEqualTypeOf<"v0">();
    expectTypeOf<$MergeOutputVersion<null, null>>().toEqualTypeOf<"v0">();
    expectTypeOf<$MergeOutputVersion<never, never>>().toEqualTypeOf<"v0">();
  });

  it("should use U when T is undefined and U is defined", async () => {
    expectTypeOf<$MergeOutputVersion<undefined, "v0">>().toEqualTypeOf<"v0">();
    expectTypeOf<$MergeOutputVersion<undefined, "v1">>().toEqualTypeOf<"v1">();

    // T normalizes to undefined
    expectTypeOf<$MergeOutputVersion<unknown, "v1">>().toEqualTypeOf<"v1">();
    expectTypeOf<$MergeOutputVersion<never, "v0">>().toEqualTypeOf<"v0">();
    expectTypeOf<
      $MergeOutputVersion<string, MessageOutputVersion>
    >().toEqualTypeOf<MessageOutputVersion>();
  });

  it("should use T when U is undefined and T is defined", async () => {
    expectTypeOf<$MergeOutputVersion<"v0", undefined>>().toEqualTypeOf<"v0">();
    expectTypeOf<$MergeOutputVersion<"v1", undefined>>().toEqualTypeOf<"v1">();

    // U normalizes to undefined
    expectTypeOf<
      $MergeOutputVersion<MessageOutputVersion, string>
    >().toEqualTypeOf<MessageOutputVersion>();
    expectTypeOf<$MergeOutputVersion<"v0", unknown>>().toEqualTypeOf<"v0">();
    expectTypeOf<$MergeOutputVersion<"v1", never>>().toEqualTypeOf<"v1">();
  });

  // TODO(hntrl): fix this test
  // it("should prefer U when both are defined", async () => {
  //   expectTypeOf<$MergeOutputVersion<"v0", "v0">>().toExtend<"v0">();
  //   expectTypeOf<$MergeOutputVersion<"v0", "v1">>().toExtend<"v1">();
  //   expectTypeOf<$MergeOutputVersion<"v1", "v0">>().toExtend<"v0">();
  //   expectTypeOf<$MergeOutputVersion<"v1", "v1">>().toExtend<"v1">();

  //   // When U is a union, the result should equal U
  //   expectTypeOf<
  //     $MergeOutputVersion<"v0", MessageOutputVersion>
  //   >().toEqualTypeOf<MessageOutputVersion>();
  //   // When U is a literal, the result should equal that literal
  //   expectTypeOf<
  //     $MergeOutputVersion<MessageOutputVersion, "v1">
  //   >().toEqualTypeOf<"v1">();
  //   expectTypeOf<
  //     $MergeOutputVersion<MessageOutputVersion, MessageOutputVersion>
  //   >().toEqualTypeOf<MessageOutputVersion>();
  // });
});

describe("$MergeContentDefinition<T, U>", () => {
  // TODO(hntrl): implement
});

describe("$MergeMessageStructure<T, U>", () => {
  it("should merge tools from T and U", async () => {
    interface T extends MessageStructure {
      tools: {
        a: MessageToolDefinition<{ x: number }, string>;
      };
    }
    interface U extends MessageStructure {
      tools: {
        b: MessageToolDefinition<{ y: string }, number>;
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
      MessageToolDefinition<{ x: number }, string>
    >();
    expectTypeOf<Tools["b"]>().toEqualTypeOf<
      MessageToolDefinition<{ y: string }, number>
    >();
  });

  it("should merge tools from T and U with U taking precedence on conflicts", async () => {
    interface T extends MessageStructure {
      tools: {
        calc: MessageToolDefinition<{ x: number }, string>;
      };
    }
    interface U extends MessageStructure {
      tools: {
        calc: MessageToolDefinition<{ q: string }, number>;
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
      MessageToolDefinition<{ q: string }, number>
    >();
  });

  it("should merge content per role using discriminated-union merge when both define a role", async () => {
    interface T extends MessageStructure {
      content: {
        human: ContentBlock.Text | ContentBlock.Reasoning;
      };
    }
    interface U extends MessageStructure {
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
    interface T extends MessageStructure {
      content: {
        system: ContentBlock.Text;
      };
    }

    type M = $MergeMessageStructure<T, MessageStructure>;
    type C = M["content"];
    type HasSystem = "system" extends keyof C ? true : false;

    expectTypeOf<HasSystem>().toEqualTypeOf<true>();
    expectTypeOf<C["system"]>().toExtend<ContentBlock.Text>();
  });

  it("should take content from U when only U defines the role", async () => {
    interface U extends MessageStructure {
      content: {
        tool: ContentBlock.Text;
      };
    }

    type M = $MergeMessageStructure<MessageStructure, U>;
    type C = NonNullable<M["content"]>;
    type HasTool = "tool" extends keyof C ? true : false;

    expectTypeOf<HasTool>().toEqualTypeOf<true>();
    expectTypeOf<C["tool"]>().toExtend<ContentBlock.Text>();
  });

  it("should merge properties per role with U taking precedence on conflicts", async () => {
    interface T extends MessageStructure {
      properties: {
        ai: { a: number; overlap: number };
      };
    }
    interface U extends MessageStructure {
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
  it("should return T unchanged when T extends StandardMessageStructure", async () => {
    type N = $NormalizedMessageStructure<StandardMessageStructure>;
    expectTypeOf<N>().toEqualTypeOf<StandardMessageStructure>();
  });

  it("should merge StandardMessageStructure with T when T extends only MessageStructure", async () => {
    interface T {
      content: {
        human: ContentBlock.Multimodal.Image;
      };
      properties: {
        ai: { usage_metadata: { extra: boolean } };
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
      response_metadata: ResponseMetadata | undefined;
      usage_metadata: { extra: boolean };
    }>();
  });

  it("should ensure standard roles exist after normalization", async () => {
    type N = $NormalizedMessageStructure<MessageStructure>;

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
      response_metadata: ResponseMetadata;
      usage_metadata: UsageMetadata;
    }>();
    expectTypeOf<NonNullable<N["properties"]>["human"]>().toEqualTypeOf<{
      response_metadata: Record<string, unknown>;
    }>();
    expectTypeOf<NonNullable<N["properties"]>["system"]>().toEqualTypeOf<{
      response_metadata: Record<string, unknown>;
    }>();
    expectTypeOf<NonNullable<N["properties"]>["tool"]>().toEqualTypeOf<{
      response_metadata: Record<string, unknown>;
    }>();
  });
});

describe("$InferMessageContentBlocks", () => {
  it("should return the standard ContentBlock type for TRole from TStructure.content", async () => {
    interface S extends MessageStructure {
      content: {
        ai: ContentBlock.Text | ContentBlock.Reasoning;
        human: ContentBlock.Multimodal.Image;
      };
    }

    type AI = $InferMessageContentBlocks<S, "ai">;
    type Human = $InferMessageContentBlocks<S, "human">;

    expectTypeOf<AI>().toExtend<ContentBlock.Text | ContentBlock.Reasoning>();
    expectTypeOf<Human>().toExtend<
      ContentBlock.Text | ContentBlock.Multimodal.Image
    >();
  });

  it("should include standard roles when TStructure.content is empty", async () => {
    type S = MessageStructure;
    type AI = $InferMessageContentBlocks<S, "ai">;
    type Human = $InferMessageContentBlocks<S, "human">;
    type System = $InferMessageContentBlocks<S, "system">;
    type Tool = $InferMessageContentBlocks<S, "tool">;

    expectTypeOf<AI>().toExtend<ContentBlock.Text>();
    expectTypeOf<Human>().toExtend<ContentBlock.Text>();
    expectTypeOf<System>().toExtend<ContentBlock.Text>();
    expectTypeOf<Tool>().toExtend<ContentBlock.Text>();
  });

  it("should include standard roles when TStructure.content has a non-standard role", async () => {
    interface S extends MessageStructure {
      content: {
        foo: ContentBlock.Text;
      };
    }
    type Foo = $InferMessageContentBlocks<S, "foo">;
    expectTypeOf<Foo>().toExtend<ContentBlock.Text>();

    type AI = $InferMessageContentBlocks<S, "ai">;
    type Human = $InferMessageContentBlocks<S, "human">;
    type System = $InferMessageContentBlocks<S, "system">;
    type Tool = $InferMessageContentBlocks<S, "tool">;
    expectTypeOf<AI>().toExtend<ContentBlock.Text>();
    expectTypeOf<Human>().toExtend<ContentBlock.Text>();
    expectTypeOf<System>().toExtend<ContentBlock.Text>();
    expectTypeOf<Tool>().toExtend<ContentBlock.Text>();
  });

  it("should include standard roles when TStructure.content has standard roles", async () => {
    interface S extends MessageStructure {
      content: {
        ai: ContentBlock.Reasoning;
      };
    }
    type AI = $InferMessageContentBlocks<S, "ai">;
    expectTypeOf<AI>().toExtend<ContentBlock.Text | ContentBlock.Reasoning>();

    type Human = $InferMessageContentBlocks<S, "human">;
    type System = $InferMessageContentBlocks<S, "system">;
    type Tool = $InferMessageContentBlocks<S, "tool">;
    expectTypeOf<Human>().toExtend<ContentBlock.Text>();
    expectTypeOf<System>().toExtend<ContentBlock.Text>();
    expectTypeOf<Tool>().toExtend<ContentBlock.Text>();
  });

  it("should include $MessageToolCallBlock<TStructure> via discriminated union when tools are present", async () => {
    interface S extends MessageStructure {
      tools: {
        search: MessageToolDefinition<{ q: string }, string>;
      };
      content: {
        ai: ContentBlock.Text;
      };
    }

    type AI = $InferMessageContentBlocks<S, "ai">;
    type ToolCall = Extract<AI, { type: "tool_call" }>;

    // tool_call block exists and is correctly shaped
    expectTypeOf<ToolCall>().toExtend<{
      type: "tool_call";
      name: "search";
      args: { q: string };
    }>();
  });

  it("should include properties from tool call blocks provided in the structure that are constrainted by a structures tools", async () => {
    interface S extends MessageStructure {
      tools: {
        translate: MessageToolDefinition<{ text: string; to: string }, string>;
        summarize: MessageToolDefinition<{ text: string }, string>;
      };
      content: {
        ai: ContentBlock.Text;
        human: ContentBlock.Text;
      };
    }

    type AI = $InferMessageContentBlocks<S, "ai">;
    type Human = $InferMessageContentBlocks<S, "human">;

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
    interface S extends MessageStructure {
      content: {
        ai: ContentBlock.Text;
      };
    }

    type AI = $InferMessageContentBlocks<S, "ai">;
    type ToolCall = Extract<AI, { type: "tool_call" }>;

    expectTypeOf<ToolCall>().toEqualTypeOf<never>();
  });

  it("should include content from a merged structure", async () => {
    interface T extends MessageStructure {
      content: {
        ai: ContentBlock.Text;
      };
    }
    interface U extends MessageStructure {
      content: {
        human: ContentBlock.Multimodal.Image;
      };
    }

    type M = $MergeMessageStructure<T, U>;
    type AI = $InferMessageContentBlocks<M, "ai">;
    type Human = $InferMessageContentBlocks<M, "human">;
    type System = $InferMessageContentBlocks<M, "system">;

    expectTypeOf<AI>().toExtend<ContentBlock.Text>();
    expectTypeOf<Human>().toExtend<
      ContentBlock.Text | ContentBlock.Multimodal.Image
    >();
    expectTypeOf<System>().toExtend<ContentBlock.Text>();
  });

  it("should include tool call blocks from a merged structure", async () => {
    interface T extends MessageStructure {
      tools: {
        search: MessageToolDefinition<{ q: string }, string>;
      };
      content: {
        ai: ContentBlock.Text;
      };
    }
    interface U extends MessageStructure {
      tools: {
        translate: MessageToolDefinition<{ text: string; to: string }, string>;
      };
    }

    type M = $MergeMessageStructure<T, U>;
    type AI = $InferMessageContentBlocks<M, "ai">;
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

describe("$InferMessageContent<TStructure, TRole>", () => {
  // TODO(hntrl): implement
});

describe("$InferMessageProperties<TStructure, TRole>", () => {
  it("should return standard properties when TStructure.properties is empty", async () => {
    type S = MessageStructure;

    type AIProps = $InferMessageProperties<S, "ai">;
    expectTypeOf<AIProps>().toEqualTypeOf<{
      response_metadata: ResponseMetadata;
      usage_metadata: UsageMetadata;
    }>();

    type HumanProps = $InferMessageProperties<S, "human">;
    expectTypeOf<HumanProps>().toEqualTypeOf<{
      response_metadata: Record<string, unknown>;
    }>();

    type SystemProps = $InferMessageProperties<S, "system">;
    expectTypeOf<SystemProps>().toEqualTypeOf<{
      response_metadata: Record<string, unknown>;
    }>();

    type ToolProps = $InferMessageProperties<S, "tool">;
    expectTypeOf<ToolProps>().toEqualTypeOf<{
      response_metadata: Record<string, unknown>;
    }>();
  });

  it("should return standard properties and the properties object for TRole from TStructure.properties", async () => {
    interface S extends MessageStructure {
      properties: {
        ai: { foo: { bar: number } };
        human: { metadata: { qux: string } };
      };
    }
    type AIProps = $InferMessageProperties<S, "ai">;
    type HumanProps = $InferMessageProperties<S, "human">;

    expectTypeOf<AIProps>().toEqualTypeOf<{
      response_metadata: ResponseMetadata;
      usage_metadata: UsageMetadata;
      foo: { bar: number };
    }>();
    expectTypeOf<HumanProps>().toEqualTypeOf<{
      response_metadata: Record<string, unknown>;
      metadata: { qux: string };
    }>();
  });

  it("should omit keys 'content' and 'type' from the result", async () => {
    interface S extends MessageStructure {
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
      response_metadata: ResponseMetadata;
      usage_metadata: UsageMetadata;
      keep: boolean;
      nested: { a: number };
    }>();
  });

  it("should fall back to Record<string, unknown> when TRole is not present", async () => {
    interface S extends MessageStructure {
      properties: {
        human: { some: number };
      };
    }
    type SystemProps = $InferMessageProperties<S, "foo">;

    expectTypeOf<SystemProps>().toEqualTypeOf<Record<string, unknown>>();
  });

  it("should include properties from a merged structure", async () => {
    interface T extends MessageStructure {
      properties: {
        ai: { foo: { bar: number } };
      };
    }
    interface U extends MessageStructure {
      properties: {
        ai: { foo: { bar: string; baz: number }; baz: { qux: string } };
      };
    }

    type M = $MergeMessageStructure<T, U>;
    type AIProps = $InferMessageProperties<M, "ai">;

    expectTypeOf<AIProps>().toEqualTypeOf<{
      response_metadata: ResponseMetadata;
      usage_metadata: UsageMetadata;
      foo: { bar: string; baz: number };
      baz: { qux: string };
    }>();
  });
});

describe("$InferMessageProperty<TStructure, TRole, K>", () => {
  it("should return the property type at key K for TRole", async () => {
    interface S extends MessageStructure {
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
    interface S extends MessageStructure {
      properties: {
        ai: { foo: { bar: number } };
      };
    }

    type Missing = $InferMessageProperty<S, "ai", "doesNotExist">;
    expectTypeOf<Missing>().toEqualTypeOf<never>();
  });
});

describe("$InferResponseMetadata<TStructure, TRole>", () => {
  // TODO(hntrl): implement
  test("should return `ResponseMetadata | undefined` when using `<MessageStructure, 'ai'>`", async () => {
    type AIResponseMetadata = $InferResponseMetadata<MessageStructure, "ai">;
    expectTypeOf<AIResponseMetadata>().toEqualTypeOf<ResponseMetadata>();
  });
});

describe("$InferToolCalls<TStructure>", () => {
  it("should return a fallback type when tools are not defined", async () => {
    type ToolCalls = $InferToolCalls<MessageStructure>;

    expectTypeOf<ToolCalls>().toEqualTypeOf<{
      readonly type?: "tool_call";
      id?: string;
      name: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      args: Record<string, any>;
    }>();
  });

  it("should return a union of tool call types when tools are defined", async () => {
    interface S extends MessageStructure {
      tools: {
        calculator: MessageToolDefinition<{ a: number; b: number }, number>;
        search: MessageToolDefinition<{ query: string }, string[]>;
      };
    }

    type ToolCalls = $InferToolCalls<S>;

    // Should be a union of tool call types for each tool
    expectTypeOf<ToolCalls["name"]>().toEqualTypeOf<"calculator" | "search">();

    // Extract individual tool calls
    type CalcCall = Extract<ToolCalls, { name: "calculator" }>;
    type SearchCall = Extract<ToolCalls, { name: "search" }>;

    expectTypeOf<CalcCall>().toExtend<{
      readonly type?: "tool_call";
      id?: string;
      name: "calculator";
      args: { a: number; b: number };
    }>();

    expectTypeOf<SearchCall>().toExtend<{
      readonly type?: "tool_call";
      id?: string;
      name: "search";
      args: { query: string };
    }>();
  });

  it("should narrow args type to the specific tool input", async () => {
    interface S extends MessageStructure {
      tools: {
        translate: MessageToolDefinition<
          { text: string; to: string; from?: string },
          string
        >;
      };
    }

    type ToolCalls = $InferToolCalls<S>;
    type TranslateCall = Extract<ToolCalls, { name: "translate" }>;

    expectTypeOf<TranslateCall["args"]>().toEqualTypeOf<{
      text: string;
      to: string;
      from?: string;
    }>();
  });

  it("should use Record<string, any> fallback when tool input is unknown", async () => {
    interface S extends MessageStructure {
      tools: {
        dynamicTool: MessageToolDefinition<unknown, string>;
      };
    }

    type ToolCalls = $InferToolCalls<S>;
    type DynamicCall = Extract<ToolCalls, { name: "dynamicTool" }>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expectTypeOf<DynamicCall["args"]>().toEqualTypeOf<Record<string, any>>();
  });

  it("should include optional type and id fields", async () => {
    interface S extends MessageStructure {
      tools: {
        myTool: MessageToolDefinition<{ x: number }, string>;
      };
    }

    type ToolCalls = $InferToolCalls<S>;

    // type should be optional and narrowed to "tool_call"
    expectTypeOf<ToolCalls["type"]>().toEqualTypeOf<"tool_call" | undefined>();

    // id should be optional string
    expectTypeOf<ToolCalls["id"]>().toEqualTypeOf<string | undefined>();
  });

  it("should work with merged structures", async () => {
    interface T extends MessageStructure {
      tools: {
        toolA: MessageToolDefinition<{ a: number }, string>;
      };
    }
    interface U extends MessageStructure {
      tools: {
        toolB: MessageToolDefinition<{ b: string }, number>;
      };
    }

    type M = $MergeMessageStructure<T, U>;
    type ToolCalls = $InferToolCalls<M>;

    expectTypeOf<ToolCalls["name"]>().toEqualTypeOf<"toolA" | "toolB">();

    type ToolACall = Extract<ToolCalls, { name: "toolA" }>;
    type ToolBCall = Extract<ToolCalls, { name: "toolB" }>;

    expectTypeOf<ToolACall["args"]>().toEqualTypeOf<{ a: number }>();
    expectTypeOf<ToolBCall["args"]>().toEqualTypeOf<{ b: string }>();
  });
});

describe("$InferToolOutputs<TStructure>", () => {
  it("should return unknown when tools are not defined", async () => {
    type ToolOutputs = $InferToolOutputs<MessageStructure>;
    expectTypeOf<ToolOutputs>().toEqualTypeOf<unknown>();
  });

  it("should return a union of tool output types when tools are defined", async () => {
    interface S extends MessageStructure {
      tools: {
        calculator: MessageToolDefinition<{ a: number; b: number }, number>;
        search: MessageToolDefinition<{ query: string }, string[]>;
      };
    }

    type ToolOutputs = $InferToolOutputs<S>;

    // Should be a union of output types: number | string[]
    expectTypeOf<ToolOutputs>().toEqualTypeOf<number | string[]>();
  });

  it("should return the single output type when only one tool is defined", async () => {
    interface S extends MessageStructure {
      tools: {
        translate: MessageToolDefinition<{ text: string }, string>;
      };
    }

    type ToolOutputs = $InferToolOutputs<S>;
    expectTypeOf<ToolOutputs>().toEqualTypeOf<string>();
  });

  it("should handle complex output types", async () => {
    interface SearchResult {
      title: string;
      url: string;
      snippet: string;
    }

    interface S extends MessageStructure {
      tools: {
        search: MessageToolDefinition<{ query: string }, SearchResult[]>;
        fetch: MessageToolDefinition<
          { url: string },
          { status: number; body: string }
        >;
      };
    }

    type ToolOutputs = $InferToolOutputs<S>;

    expectTypeOf<ToolOutputs>().toEqualTypeOf<
      SearchResult[] | { status: number; body: string }
    >();
  });

  it("should work with merged structures", async () => {
    interface T extends MessageStructure {
      tools: {
        toolA: MessageToolDefinition<{ a: number }, boolean>;
      };
    }
    interface U extends MessageStructure {
      tools: {
        toolB: MessageToolDefinition<{ b: string }, { result: string }>;
      };
    }

    type M = $MergeMessageStructure<T, U>;
    type ToolOutputs = $InferToolOutputs<M>;

    expectTypeOf<ToolOutputs>().toEqualTypeOf<boolean | { result: string }>();
  });

  it("should handle tool with void output", async () => {
    interface S extends MessageStructure {
      tools: {
        sideEffect: MessageToolDefinition<{ action: string }, void>;
        getData: MessageToolDefinition<{ id: string }, { data: string }>;
      };
    }

    type ToolOutputs = $InferToolOutputs<S>;
    expectTypeOf<ToolOutputs>().toEqualTypeOf<void | { data: string }>();
  });

  it("should handle tool with undefined output", async () => {
    interface S extends MessageStructure {
      tools: {
        maybeFind: MessageToolDefinition<
          { id: string },
          { value: string } | undefined
        >;
      };
    }

    type ToolOutputs = $InferToolOutputs<S>;
    expectTypeOf<ToolOutputs>().toEqualTypeOf<{ value: string } | undefined>();
  });
});

describe("Message", () => {
  it("message classes should be assignable", async () => {
    expectTypeOf<AIMessage>().toExtend<Message>();
    expectTypeOf<HumanMessage>().toExtend<Message>();
    expectTypeOf<SystemMessage>().toExtend<Message>();
    expectTypeOf<ToolMessage>().toExtend<Message>();
  });

  it("generic objects should be assignable", async () => {
    expectTypeOf<{
      type: "ai";
      id: string;
      content: string | ContentBlock[];
    }>().toExtend<Message>();
  });

  it("should have v0 content by default", async () => {
    const m = new AIMessage("hello world");
    expectTypeOf<typeof m.content>().toEqualTypeOf<
      string | (ContentBlock | ContentBlock.Text)[]
    >();
  });
});

// TODO(hntrl): implement scratch tests
