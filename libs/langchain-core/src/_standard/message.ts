import { ContentBlock } from "./content";
import { $Expand, $Merge, $MergeDiscriminatedUnion } from "./utils";

/**
 * Represents the possible types of messages in the system.
 * Includes standard message types ("ai", "human", "tool", "system")
 * and allows for custom string types that are non-null.
 *
 * @example
 * ```ts
 * // Standard message types
 * const messageType1: $MessageType = "ai";
 * const messageType2: $MessageType = "human";
 *
 * // Custom message type
 * const messageType3: $MessageType = "custom_type";
 * ```
 */
export type $MessageType =
  | "ai"
  | "human"
  | "tool"
  | "system"
  | (string & NonNullable<unknown>);

/**
 * Represents the definition of a tool that can be used in messages.
 * Specifies the input and output types for the tool.
 *
 * @template TInput - The type of input the tool accepts. Defaults to unknown.
 * @template TOutput - The type of output the tool produces. Defaults to unknown.
 *
 * @example
 * ```ts
 * // Tool that takes a string input and returns a number
 * interface StringToNumberTool extends $MessageToolDefinition<string, number> {
 *   input: string;
 *   output: number;
 * }
 * ```
 */
export interface $MessageToolDefinition<TInput = unknown, TOutput = unknown> {
  input: TInput;
  output: TOutput;
}

/**
 * Represents a structured set of tools that can be used in messages.
 * Maps tool names to their corresponding tool definitions.
 *
 * @example
 * ```ts
 * interface MyToolSet extends $MessageToolSet {
 *   calculator: $MessageToolDefinition<
 *     { operation: string; numbers: number[] },
 *     number
 *   >;
 *   translator: $MessageToolDefinition<
 *     { text: string; targetLanguage: string },
 *     string
 *   >;
 * }
 * ```
 */
export interface $MessageToolSet {
  [key: string]: $MessageToolDefinition;
}

/**
 * Represents a tool call block within a message structure.
 * Maps tool names to their corresponding tool call formats, including the input arguments
 * and an optional identifier.
 *
 * @template TStructure - A message structure type that may contain tool definitions
 *
 * @example
 * ```ts
 * // Given a message structure with a calculator tool:
 * interface MyStructure extends $MessageStructure {
 *   tools: {
 *     calculator: $MessageToolDefinition<{operation: string, numbers: number[]}, number>
 *   }
 * }
 *
 * // The tool call block would be:
 * type CalcToolCall = $MessageToolCallBlock<MyStructure>;
 * // Resolves to:
 * // {
 * //   type: "tool_call";
 * //   name: "calculator";
 * //   args: {operation: string, numbers: number[]};
 * //   id?: string;
 * // }
 * ```
 */
export type $MessageToolCallBlock<TStructure extends $MessageStructure> =
  TStructure["tools"] extends $MessageToolSet
    ? {
        [K in keyof TStructure["tools"]]: {
          readonly type: "tool_call";
          name: K;
          args: TStructure["tools"][K] extends $MessageToolDefinition
            ? TStructure["tools"][K]["input"]
            : never;
        };
      }[keyof TStructure["tools"]]
    : never;

/**
 * Core interface that defines the structure of messages.
 * This interface acts as the base for describing the various shapes of messages.
 *
 * @example
 * ```ts
 * // Basic message structure with just content blocks
 * interface SimpleMessageStructure extends $MessageStructure {
 *   content: {
 *     human: ContentBlock.Text;
 *     // allows for text + reasoning blocks in ai messages
 *     ai: ContentBlock.Text | ContentBlock.Reasoning;
 *   }
 * }
 *
 * // Message structure with tools and properties
 * interface AdvancedMessageStructure extends $MessageStructure {
 *   tools: {
 *     calculator: $MessageToolDefinition<
 *       { operation: string; numbers: number[] },
 *       number
 *     >;
 *   };
 *   content: {
 *     // allows for text + image blocks in human messages
 *     human: ContentBlock.Text | ContentBlock.Multimodal.Image;
 *     // only allows for text blocks in ai messages
 *     ai: ContentBlock.Text;
 *   };
 *   properties: {
 *     // pins arbitrary properties to ai messages
 *     ai: {
 *       confidence: number;
 *       model: string;
 *     };
 *   }
 * }
 *
 * // Using with $MergeMessageStructure to combine structures
 * // The resulting type when passed into BaseMessage will have a calculator tool,
 * // allow for text + image blocks in human messages,
 * // and text + reasoning blocks + additional arbitrary properties in ai messages.
 * type CombinedStructure = $MergeMessageStructure<
 *   SimpleMessageStructure,
 *   AdvancedMessageStructure
 * >;
 * ```
 */
export interface $MessageStructure {
  /**
   * Optional set of tool definitions that can be used in messages.
   * Each tool is defined with input/output types and can be referenced in tool messages.
   */
  readonly tools?: $MessageToolSet;
  /**
   * Optional mapping of message types to their allowed content blocks.
   * Excludes the "tool" message type since tool messages have a special structure.
   * Each message type can specify what content block types it supports (text, images, etc).
   */
  readonly content?: Partial<{
    [key in $MessageType]: ContentBlock;
  }>;
  /**
   * Optional mapping of message types to arbitrary property objects.
   * Allows attaching custom metadata or other information to specific message types.
   * Properties are typed as Record<string, unknown> to allow flexible property definitions.
   */
  readonly properties?: Partial<{
    [key in $MessageType]: Record<string, unknown>;
  }>;
}

/**
 * Merges two message structures A and B into a combined structure.
 * This is a complex type utility that handles merging of tools, content blocks, and properties
 * from two message structures while preserving type safety and handling discriminated unions.
 * The resulting interface is usable as its own message structure.
 *
 * The merge strategy for each component is:
 *
 * Tools:
 * - Merges tool definitions from both structures using $Merge utility
 * - B's tools take precedence over A's tools if there are conflicts
 *
 * Content Blocks:
 * - Takes the intersection of content block types from both structures
 * - For each message type (e.g. "ai", "human"):
 *   - If both A and B define content blocks, merges them using $MergeDiscriminatedUnion
 *   - If only A defines content blocks, uses A's definition
 *   - If only B defines content blocks, uses B's definition
 * - Content blocks are merged based on their "type" discriminator
 *
 * Properties:
 * - Takes the intersection of property types from both structures
 * - For each message type:
 *   - If both A and B define properties, merges them using $Merge
 *   - If only A defines properties, uses A's properties
 *   - If only B defines properties, uses B's properties
 *
 * @example
 * ```ts
 * // Structure A allows text in human messages and has a confidence property on AI messages
 * interface StructureA extends $MessageStructure {
 *   content: {
 *     human: ContentBlock.Text;
 *   };
 *   properties: {
 *     ai: { confidence: number };
 *   }
 * }
 *
 * // Structure B allows images in human messages and has a model property on AI messages
 * interface StructureB extends $MessageStructure {
 *   content: {
 *     human: ContentBlock.Multimodal.Image;
 *   };
 *   properties: {
 *     ai: { model: string };
 *   }
 * }
 *
 * // Merged structure allows both text and images in human messages
 * // AI messages have both confidence and model properties
 * type Merged = $MergeMessageStructure<StructureA, StructureB>;
 * ```
 *
 * @template A - First message structure to merge
 * @template B - Second message structure to merge (takes precedence over A)
 */
export type $MergeMessageStructure<
  T extends $MessageStructure,
  U extends $MessageStructure
> = {
  tools: $Expand<$Merge<T["tools"], U["tools"]>>;
  content: $Expand<{
    [K in keyof (T["content"] & U["content"])]: K extends keyof T["content"] &
      keyof U["content"]
      ? $MergeDiscriminatedUnion<
          NonNullable<T["content"][K]> & Record<"type", PropertyKey>,
          NonNullable<U["content"][K]> & Record<"type", PropertyKey>,
          "type"
        >
      : K extends keyof T["content"]
      ? T["content"][K]
      : K extends keyof U["content"]
      ? U["content"][K]
      : never;
  }>;
  properties: $Merge<T["properties"], U["properties"]>;
};

const STANDARD_MESSAGE_STRUCTURE_TYPE = Symbol.for(
  "langchain.message.std-structure"
);

/**
 * Standard message structured used to define the most basic message structure that's
 * used throughout the library.
 *
 * This is also the message structure that's used when a message structure is not provided.
 */
export type $StandardMessageStructure = {
  /** @internal Discriminator to give TS a hint when evaluating if a type is a standard message structure */
  [STANDARD_MESSAGE_STRUCTURE_TYPE]: never;
  content: {
    /** Text content for AI messages */
    ai: ContentBlock.Text;
    /** Text content for human messages */
    human: ContentBlock.Text;
    /** Text content for system messages */
    system: ContentBlock.Text;
    /** Text content for tool messages */
    tool: ContentBlock.Text;
  };
  properties: {
    /** Properties specific to AI messages */
    ai: {
      /** Metadata about the AI model response */
      responseMetadata: {
        /** Name of the AI model provider */
        modelProvider: string;
        /** Name of the specific AI model used */
        modelName: string;
      };
      /** Usage statistics for the AI response */
      usageMetadata: {
        /** Number of input tokens used */
        inputTokens: number;
        /** Number of output tokens generated */
        outputTokens: number;
        /** Total number of tokens used */
        totalTokens: number;
      };
    };
    human: {
      /** Metadata about the human message */
      metadata: Record<string, unknown>;
    };
    system: {
      /** Metadata about the system message */
      metadata: Record<string, unknown>;
    };
    tool: {
      /** Metadata about the tool message */
      metadata: Record<string, unknown>;
    };
  };
};

/**
 * Takes a message structure type T and normalizes it by merging it with the standard message structure.
 * If T is already a standard message structure, returns T unchanged.
 *
 * This ensures that any custom message structure includes all the standard message structure fields
 * while allowing overrides and extensions.
 *
 * @template T - The message structure type to normalize, must extend $MessageStructure
 * @returns Either T if it's already a standard structure, or the merged result of T with standard structure
 */
export type $NormalizedMessageStructure<T extends $MessageStructure> =
  T extends $StandardMessageStructure
    ? T
    : $MergeMessageStructure<$StandardMessageStructure, T>;

/**
 * Infers the content type for a specific message role from a message structure.
 *
 * This utility type extracts the content block type that corresponds to a given message role
 * from the message structure's content definition. It safely handles cases where the content
 * property might be undefined or not properly structured.
 *
 * @template TStructure - The message structure to infer content from
 * @template TRole - The message role/type to get content for (e.g., "ai", "human", "system", "tool")
 * @returns The content block type for the specified role, or never if not found
 *
 * @example
 * ```ts
 * interface MyStructure extends $MessageStructure {
 *   content: {
 *     human: ContentBlock.Text;
 *     ai: ContentBlock.Text | ContentBlock.ToolCall;
 *   };
 * }
 *
 * type HumanContent = $InferMessageContent<MyStructure, "human">;
 * // HumanContent = ContentBlock.Text
 *
 * type AIContent = $InferMessageContent<MyStructure, "ai">;
 * // AIContent = ContentBlock.Text | ContentBlock.ToolCall
 * ```
 */
export type $InferMessageContent<
  TStructure extends $MessageStructure,
  TRole extends $MessageType
> = $NormalizedMessageStructure<TStructure> extends infer S
  ? S extends $MessageStructure
    ? S["content"] extends infer C | undefined
      ? C extends Record<PropertyKey, unknown>
        ? TRole extends keyof C
          ? S["tools"] extends undefined
            ? C[TRole]
            : $MergeDiscriminatedUnion<
                NonNullable<C[TRole]> & Record<"type", PropertyKey>,
                $MessageToolCallBlock<S>,
                "type"
              >
          : never
        : never
      : never
    : never
  : never;

/**
 * Infers the properties type for a specific message role from a message structure.
 *
 * This utility type extracts the properties object that corresponds to a given message role
 * from the message structure's properties definition. It automatically excludes the reserved
 * "content" and "type" properties to avoid conflicts with the core message structure.
 *
 * If the specified role is not defined in the message structure's properties, it returns
 * a generic Record<string, unknown> type to allow for arbitrary properties.
 *
 * @template TStructure - The message structure to infer properties from
 * @template TRole - The message role/type to get properties for (e.g., "ai", "human", "system", "tool")
 * @returns The properties object type for the specified role, excluding "content" and "type"
 *
 * @example
 * ```ts
 * interface MyStructure extends $MessageStructure {
 *   properties: {
 *     ai: {
 *       responseMetadata: { model: string };
 *       usageMetadata: { tokens: number };
 *       content: string; // This will be omitted
 *       type: string;    // This will be omitted
 *     };
 *     human: { metadata: Record<string, unknown> };
 *   };
 * }
 *
 * type AIProperties = $InferMessageProperties<MyStructure, "ai">;
 * // AIProperties = { responseMetadata: { model: string }; usageMetadata: { tokens: number } }
 *
 * type HumanProperties = $InferMessageProperties<MyStructure, "human">;
 * // HumanProperties = { metadata: Record<string, unknown> }
 *
 * type SystemProperties = $InferMessageProperties<MyStructure, "system">;
 * // SystemProperties = Record<string, unknown> (fallback for undefined role)
 * ```
 */
export type $InferMessageProperties<
  TStructure extends $MessageStructure,
  TRole extends $MessageType
> = $NormalizedMessageStructure<TStructure> extends infer S
  ? S extends $MessageStructure
    ? S["properties"] extends infer P | undefined
      ? P extends Record<PropertyKey, unknown>
        ? TRole extends keyof P
          ? Omit<P[TRole], "content" | "type">
          : Record<string, unknown>
        : never
      : never
    : never
  : never;

/**
 * Infers the type of a specific property for a message role from a message structure.
 *
 * This utility type extracts the type of a single property by name from the properties
 * object that corresponds to a given message role. It builds upon $InferMessageProperties
 * to provide type-safe access to individual properties.
 *
 * If the specified property key does not exist in the role's properties, it returns `never`.
 * This ensures type safety by preventing access to non-existent properties.
 *
 * @template TStructure - The message structure to infer the property from
 * @template TRole - The message role/type to get the property for (e.g., "ai", "human", "system", "tool")
 * @template K - The property key to extract the type for
 * @returns The type of the specified property, or `never` if the property doesn't exist
 *
 * @example
 * ```ts
 * interface MyStructure extends $MessageStructure {
 *   properties: {
 *     ai: {
 *       responseMetadata: { model: string; temperature: number };
 *       usageMetadata: { inputTokens: number; outputTokens: number };
 *     };
 *     human: { metadata: Record<string, unknown> };
 *   };
 * }
 *
 * type ResponseMetadata = $InferMessageProperty<MyStructure, "ai", "responseMetadata">;
 * // ResponseMetadata = { model: string; temperature: number }
 *
 * type UsageMetadata = $InferMessageProperty<MyStructure, "ai", "usageMetadata">;
 * // UsageMetadata = { inputTokens: number; outputTokens: number }
 *
 * type NonExistentProperty = $InferMessageProperty<MyStructure, "ai", "nonExistent">;
 * // NonExistentProperty = never
 *
 * type HumanMetadata = $InferMessageProperty<MyStructure, "human", "metadata">;
 * // HumanMetadata = Record<string, unknown>
 * ```
 */
export type $InferMessageProperty<
  TStructure extends $MessageStructure,
  TRole extends $MessageType,
  K extends string
> = K extends keyof $InferMessageProperties<TStructure, TRole>
  ? $InferMessageProperties<TStructure, TRole>[K]
  : never;

export interface Message<
  TStructure extends $MessageStructure = $StandardMessageStructure,
  TRole extends $MessageType = $MessageType
> {
  id: string;
  name?: string;
  readonly type: TRole;
  content: Array<$InferMessageContent<TStructure, TRole>>;
}

export class AIMessage<
  TStructure extends $MessageStructure = $StandardMessageStructure
> implements Message<TStructure, "ai">
{
  id: string;
  name?: string;
  readonly type: "ai" = "ai";
  content: Array<$InferMessageContent<TStructure, "ai">>;
  responseMetadata: $InferMessageProperty<TStructure, "ai", "responseMetadata">;
  usageMetadata: $InferMessageProperty<TStructure, "ai", "usageMetadata">;

  constructor(text: string);
  constructor(content: Array<$InferMessageContent<TStructure, "human">>);
  constructor(
    textOrContent: string | Array<$InferMessageContent<TStructure, "human">>
  ) {
    if (typeof textOrContent === "string") {
      this.content = [{ type: "text", text: textOrContent }];
    } else {
      this.content = textOrContent;
    }
  }
}

export class HumanMessage<
  TStructure extends $MessageStructure = $StandardMessageStructure
> implements Message<TStructure, "human">
{
  id: string;
  name?: string;
  readonly type: "human" = "human";
  content: Array<$InferMessageContent<TStructure, "human">>;
  metadata: $InferMessageProperty<TStructure, "human", "metadata">;

  constructor(text: string);
  constructor(content: Array<$InferMessageContent<TStructure, "human">>);
  constructor(
    textOrContent: string | Array<$InferMessageContent<TStructure, "human">>
  ) {
    if (typeof textOrContent === "string") {
      this.content = [{ type: "text", text: textOrContent }];
    } else {
      this.content = textOrContent;
    }
  }

  get text() {
    return this.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  }
}

export class SystemMessage<
  TStructure extends $MessageStructure = $StandardMessageStructure
> implements Message<TStructure, "system">
{
  id: string;
  name?: string;
  readonly type: "system" = "system";
  content: Array<$InferMessageContent<TStructure, "system">>;
  metadata: $InferMessageProperty<TStructure, "system", "metadata">;

  constructor(text: string);
  constructor(content: Array<$InferMessageContent<TStructure, "human">>);
  constructor(
    textOrContent: string | Array<$InferMessageContent<TStructure, "human">>
  ) {
    if (typeof textOrContent === "string") {
      this.content = [{ type: "text", text: textOrContent }];
    } else {
      this.content = textOrContent;
    }
  }

  get text() {
    return this.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  }
}

export class ToolMessage<
  TStructure extends $MessageStructure = $StandardMessageStructure
> implements Message<TStructure, "tool">
{
  id: string;
  name?: string;
  readonly type: "tool" = "tool";
  content: Array<$InferMessageContent<TStructure, "tool">>;
  metadata: $InferMessageProperty<TStructure, "tool", "metadata">;

  get text() {
    return this.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  }
}
