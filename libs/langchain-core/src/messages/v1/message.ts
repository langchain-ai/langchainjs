import { BaseContentBlock } from "../content/base.js";
import { SerializedConstructor } from "../../load/serializable.js";
import type { ContentBlock } from "../content/index.js";
import {
  iife,
  type $MergeDiscriminatedUnion,
  type $MergeObjects,
} from "./utils.js";

/** @internal */
const __MESSAGE_CLASS = Symbol.for("langchain.message");

/**
 * Branded type for identifying messages.
 * TypeScript uses *structural* typing meaning anything with the same shape as type `T` is a `T`.
 * For the message classes exported by langchain we want *nominal* typing (i.e. in certain cases
 * we only want to accept the literal `AIMessage` from langchain, not any other objects with the same shape)
 */
interface $BrandedMessage {
  readonly [__MESSAGE_CLASS]: true;
}

/**
 * Type guard to check if a value is a branded message.
 *
 * @param message - The value to check
 * @param role - The role of the message
 * @returns true if the value is a branded message, false otherwise
 */
export function isBrandedMessage(
  message: unknown,
  role?: $MessageType
): message is $BrandedMessage {
  const isBranded =
    typeof message === "object" &&
    message !== null &&
    __MESSAGE_CLASS in message &&
    message[__MESSAGE_CLASS] === true;

  if (role === undefined) return isBranded;
  return (
    isBranded &&
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === role
  );
}

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
  tools: $MergeObjects<T["tools"], U["tools"]>;
  content: {
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
  };
  properties: $MergeObjects<T["properties"], U["properties"]>;
};

/** @internal */
const __STANDARD_STRUCTURE = Symbol.for("langchain.message.std-structure");

/**
 * Standard message structured used to define the most basic message structure that's
 * used throughout the library.
 *
 * This is also the message structure that's used when a message structure is not provided.
 */
export type $StandardMessageStructure = {
  /** @internal Discriminator to give TS a hint when evaluating if a type is a standard message structure */
  [__STANDARD_STRUCTURE]: never;
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
          ? TStructure["tools"] extends undefined
            ? C[TRole]
            : $MergeDiscriminatedUnion<
                NonNullable<C[TRole]> & Record<"type", PropertyKey>,
                $MessageToolCallBlock<TStructure>,
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

type MessageContent = string | Array<ContentBlock>;

/**
 * Represents a message object that organizes context for an LLM.
 *
 * @example
 * ```ts
 * // Basic message with text content
 * const message: Message = {
 *   id: "msg-123",
 *   name: "user",
 *   type: "human",
 *   content: [{ type: "text", text: "Hello!" }]
 * };
 *
 * // Basic ai message interface extension
 * interface MyMessage extends Message<$StandardMessageStructure, "ai"> {
 *   // Additional AI-specific properties can be added here
 * }
 *`
 * // Custom message structure
 * interface CustomStructure extends $MessageStructure {
 *   content: {
 *     ai: ContentBlock.Text | ContentBlock.ToolCall;
 *     human: ContentBlock.Text | ContentBlock.Multimodal.Image;
 *   };
 * }
 *
 * // Create a message with custom structure
 * const message: Message<CustomStructure> = {
 *   id: "msg-123",
 *   name: "user",
 *   type: "ai",
 *   content: [
 *     { type: "text", text: "Hello!" },
 *     {
 *       type: "tool_call",
 *       name: "search",
 *       args: { query: "What is the capital of France?" }
 *     }
 *   ]
 * };
 * ```
 */
export interface Message {
  /** The message type/role, determines the content structure and available properties */
  readonly type: $MessageType;
  /** Unique identifier for this message */
  id?: string;
  /** Optional name/identifier for the entity that created this message */
  name?: string;
  /** Array of content blocks that make up the message content, typed based on the structure and role */
  content: MessageContent;
}

/**
 * Type guard to check if a value is a valid Message object.
 *
 * @param message - The value to check
 * @returns true if the value is a valid Message object, false otherwise
 */
export function isMessage(message: unknown): message is Message {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    "content" in message &&
    (typeof message.content === "string" || Array.isArray(message.content))
  );
}

/** Parameters for creating an AIMessage */
export type AIMessageParams<
  TStructure extends $MessageStructure = $StandardMessageStructure
> = {
  /** Optional unique identifier for the message */
  id?: string;
  /** Optional name/identifier for the AI that generated this message */
  name?: string;
  /** The content of the message which can be a string or an iterable of content blocks */
  content: string | Iterable<BaseContentBlock>;
  /** Optional metadata about the AI model response (model provider, model name, etc.) */
  responseMetadata?: $InferMessageProperty<
    TStructure,
    "ai",
    "responseMetadata"
  >;
  /** Optional usage statistics for the AI response (token counts, etc.) */
  usageMetadata?: $InferMessageProperty<TStructure, "ai", "usageMetadata">;
};

/**
 * Represents a message from an AI assistant or model.
 *
 * This class implements the Message interface specifically for AI-generated content,
 * providing type-safe access to AI-specific properties like response metadata and usage statistics.
 *
 * @template TStructure - The message structure type that defines the content and property types.
 *                        Defaults to $StandardMessageStructure.
 *
 * @example
 * ```ts
 * // Create an AI message with simple text
 * const aiMessage = new AIMessage("Hello, how can I help you?");
 *
 * // Access the combined text content
 * console.log(aiMessage.text); // "Hello, how can I help you?"
 *
 * // Create an AI message with structured content
 * const aiMessageWithContent = new AIMessage([
 *   { type: "text", text: "Here's the answer: " },
 *   { type: "text", text: "42" }
 * ]);
 *
 * // Access the combined text content
 * console.log(aiMessageWithContent.text); // "Here's the answer: 42"
 * ```
 */
export class AIMessage<
  TStructure extends $MessageStructure = $StandardMessageStructure
> implements Message, $BrandedMessage
{
  /** @internal */
  readonly [__MESSAGE_CLASS] = true as const;

  /** The message type, always "ai" for AI messages */
  readonly type = "ai" as const;

  /** Unique identifier for this message */
  id?: string;

  /** Optional name/identifier for the AI that generated this message */
  name?: string;

  /** Array of content blocks that make up the message content */
  content: MessageContent;

  /** Metadata about the AI model response (model provider, model name, etc.) */
  responseMetadata?: $InferMessageProperty<
    TStructure,
    "ai",
    "responseMetadata"
  >;

  /** Usage statistics for the AI response (token counts, etc.) */
  usageMetadata?: $InferMessageProperty<TStructure, "ai", "usageMetadata">;

  constructor(
    arg: string | Iterable<BaseContentBlock> | AIMessageParams<TStructure>
  ) {
    if (typeof arg === "string") {
      // new AIMessage("Hello")
      this.content = arg;
    } else if (Symbol.iterator in arg) {
      // new AIMessage([{ type: "text", text: "Hello" }])
      this.content = Array.from(arg);
    } else {
      // new AIMessage({ ... })
      this.id = arg.id ?? "";
      this.name = arg.name;
      this.responseMetadata = arg.responseMetadata;
      this.usageMetadata = arg.usageMetadata;
      if (typeof arg.content === "string") {
        // new AIMessage({ content: "Hello" })
        this.content = arg.content;
      } else {
        // new AIMessage({ content: [{ type: "text", text: "Hello" }] })
        this.content = Array.from(arg.content);
      }
    }
  }

  get contentBlocks(): Array<$InferMessageContent<TStructure, "ai">> {
    // TODO: v0 conversions go here
    return this.content as Array<$InferMessageContent<TStructure, "ai">>;
  }

  /**
   * Gets the combined text content from all text-type content blocks.
   * Filters out non-text content blocks and concatenates the text from remaining blocks.
   *
   * @returns The concatenated text content of the message
   *
   * @example
   * ```ts
   * const message = new AIMessage([
   *   { type: "text", text: "Hello " },
   *   { type: "text", text: "world!" }
   * ]);
   * console.log(message.text); // "Hello world!"
   * ```
   */
  get text(): string {
    if (typeof this.content === "string") {
      return this.content;
    }
    const content: Array<
      $InferMessageContent<$StandardMessageStructure, "ai">
    > = this.contentBlocks;
    return content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  }

  /**
   * Gets all tool call content blocks from the message.
   * Filters the message content to return only blocks of type "tool_call".
   *
   * @returns An array of tool call blocks contained in this message
   *
   * @example
   * ```ts
   * const aiMessage = new AIMessage([
   *   { type: "text", text: "I'll help you with that calculation." },
   *   {
   *     type: "tool_call",
   *     name: "calculator",
   *     args: { operation: "add", a: 5, b: 3 }
   *   }
   * ]);
   * console.log(aiMessage.toolCalls);
   * // [{ type: "tool_call", name: "calculator", args: { operation: "add", a: 5, b: 3 } }]
   * ```
   */
  get toolCalls(): Array<$MessageToolCallBlock<TStructure>> {
    throw new Error("Not implemented");
  }

  /**
   * Type guard to check if an unknown value is an AIMessage instance.
   *
   * This method performs a runtime check to determine whether the provided
   * value is a valid AIMessage instance by checking for the appropriate
   * branding and message type.
   *
   * @param message - The unknown value to check
   * @returns true if the message is an AIMessage instance, false otherwise
   *
   * @example
   * ```ts
   * const unknownMessage: unknown = new AIMessage("Hello world!");
   *
   * if (AIMessage.isInstance(unknownMessage)) {
   *   // TypeScript now knows unknownMessage is an AIMessage
   *   console.log(unknownMessage.text); // "Hello world!"
   *   console.log(unknownMessage.type); // "ai"
   *   console.log(unknownMessage.toolCalls); // []
   * }
   * ```
   */
  static isInstance(message: unknown): message is AIMessage {
    return isBrandedMessage(message, "ai");
  }
}

/** Parameters for creating a HumanMessage */
export type HumanMessageParams<
  TStructure extends $MessageStructure = $StandardMessageStructure
> = {
  /** Optional unique identifier for the message */
  id?: string;
  /** Optional name identifier for the message sender */
  name?: string;
  /** The content of the message which can be a string or an iterable of content blocks */
  content: string | Iterable<BaseContentBlock>;
  /** Optional metadata associated with the human message, as defined by the message structure */
  metadata?: $InferMessageProperty<TStructure, "human", "metadata">;
};

/**
 * Represents a message from a human user in a conversation.
 *
 * This class implements the Message interface for human-type messages and provides
 * functionality to create messages with either simple text content or structured
 * content blocks. It supports the message structure system for type-safe content
 * and metadata handling.
 *
 * @template TStructure - The message structure type that defines allowed content blocks and properties. Defaults to $StandardMessageStructure.
 *
 * @example
 * ```ts
 * // Create a simple text message
 * const textMessage = new HumanMessage("Hello, how are you?");
 *
 * // Create a message with structured content
 * const structuredMessage = new HumanMessage([
 *   { type: "text", text: "Here's an image: " },
 *   { type: "image", url: "https://example.com/image.jpg" }
 * ]);
 *
 * // Access the text content
 * console.log(textMessage.text); // "Hello, how are you?"
 * ```
 */
export class HumanMessage<
  TStructure extends $MessageStructure = $StandardMessageStructure
> implements Message, $BrandedMessage
{
  /** @internal */
  readonly [__MESSAGE_CLASS] = true as const;

  /** The message type, always "human" for HumanMessage instances */
  readonly type = "human" as const;

  /** Unique identifier for the message */
  id?: string;

  /** Optional name identifier for the message sender */
  name?: string;

  /** Array of content blocks that make up the message content */
  content: MessageContent;

  /** Metadata associated with the human message, as defined by the message structure */
  metadata?: $InferMessageProperty<TStructure, "human", "metadata">;

  constructor(
    arg: string | Iterable<BaseContentBlock> | HumanMessageParams<TStructure>
  ) {
    if (typeof arg === "string") {
      // new HumanMessage("Hello")
      this.content = arg;
    } else if (Symbol.iterator in arg) {
      // new HumanMessage([{ type: "text", text: "Hello" }])
      this.content = Array.from(arg);
    } else {
      // new HumanMessage({ ... })
      this.id = arg.id ?? "";
      this.name = arg.name;
      this.metadata = arg.metadata;
      if (typeof arg.content === "string") {
        // new HumanMessage({ content: "Hello" })
        this.content = arg.content;
      } else {
        // new HumanMessage({ content: [{ type: "text", text: "Hello" }] })
        this.content = Array.from(arg.content);
      }
    }
  }

  get contentBlocks(): Array<$InferMessageContent<TStructure, "ai">> {
    // TODO: v0 conversions go here
    return this.content as Array<$InferMessageContent<TStructure, "ai">>;
  }

  /**
   * Gets the combined text content from all text-type content blocks.
   * Filters out non-text content blocks and concatenates the text from remaining blocks.
   *
   * @returns The concatenated text content of the message
   *
   * @example
   * ```ts
   * const message = new HumanMessage([
   *   { type: "text", text: "Hello " },
   *   { type: "text", text: "world!" }
   * ]);
   * console.log(message.text); // "Hello world!"
   * ```
   */
  get text(): string {
    if (typeof this.content === "string") {
      return this.content;
    }
    const content: Array<
      $InferMessageContent<$StandardMessageStructure, "human">
    > = this.contentBlocks;
    return content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  }

  /**
   * Type guard to check if an unknown value is a HumanMessage instance.
   *
   * This method performs a runtime check to determine whether the provided
   * value is a valid HumanMessage instance by checking for the appropriate
   * branding and message type.
   *
   * @param message - The unknown value to check
   * @returns true if the message is a HumanMessage instance, false otherwise
   *
   * @example
   * ```ts
   * const unknownMessage: unknown = new HumanMessage("Hello world!");
   *
   * if (HumanMessage.isInstance(unknownMessage)) {
   *   // TypeScript now knows unknownMessage is a HumanMessage
   *   console.log(unknownMessage.text); // "Hello world!"
   *   console.log(unknownMessage.type); // "human"
   * }
   * ```
   */
  static isInstance(message: unknown): message is HumanMessage {
    return isBrandedMessage(message, "human");
  }
}

/** Parameters for creating a SystemMessage */
export type SystemMessageParams<
  TStructure extends $MessageStructure = $StandardMessageStructure
> = {
  /** Optional unique identifier for the message */
  id?: string;
  /** Optional name/identifier for the system that generated this message */
  name?: string;
  /** The content of the message which can be a string or an iterable of content blocks */
  content: string | Iterable<BaseContentBlock>;
  /** Optional metadata associated with the system message, as defined by the message structure */
  metadata?: $InferMessageProperty<TStructure, "system", "metadata">;
};

/**
 * Represents a system message that provides context, instructions, or configuration to the AI.
 *
 * System messages are typically used to set the behavior, personality, or operational parameters
 * for an AI assistant. They are usually processed before user messages and help establish
 * the context for the conversation.
 *
 * @template TStructure - The message structure type that defines the content and property types.
 *                        Defaults to $StandardMessageStructure.
 *
 * @example
 * ```ts
 * // Create a system message with simple text
 * const systemMessage = new SystemMessage("You are a helpful assistant.");
 *
 * // Create a system message with structured content
 * const systemMessageWithContent = new SystemMessage([
 *   { type: "text", text: "You are a helpful assistant. " },
 *   { type: "text", text: "Always be polite and concise." }
 * ]);
 *
 * // Access the combined text content
 * console.log(systemMessage.text); // "You are a helpful assistant."
 * ```
 */
export class SystemMessage<
  TStructure extends $MessageStructure = $StandardMessageStructure
> implements Message, $BrandedMessage
{
  /** @internal */
  readonly [__MESSAGE_CLASS] = true as const;

  /** The message type, always "system" for system messages */
  readonly type = "system" as const;

  /** Unique identifier for this message */
  id?: string;

  /** Optional name/identifier for the system that generated this message */
  name?: string;

  /** Array of content blocks that make up the message content */
  content: MessageContent;

  /** Metadata associated with the system message */
  metadata?: $InferMessageProperty<TStructure, "system", "metadata">;

  constructor(
    arg: string | Iterable<BaseContentBlock> | SystemMessageParams<TStructure>
  ) {
    if (typeof arg === "string") {
      // new SystemMessage("Hello")
      this.content = arg;
    } else if (Symbol.iterator in arg) {
      // new SystemMessage([{ type: "text", text: "Hello" }])
      this.content = Array.from(arg);
    } else {
      // new SystemMessage({ ... })
      this.id = arg.id ?? "";
      this.name = arg.name;
      this.metadata = arg.metadata;
      if (typeof arg.content === "string") {
        // new SystemMessage({ content: "Hello" })
        this.content = arg.content;
      } else {
        // new SystemMessage({ content: [{ type: "text", text: "Hello" }] })
        this.content = Array.from(arg.content);
      }
    }
  }

  get contentBlocks(): Array<$InferMessageContent<TStructure, "ai">> {
    // TODO: v0 conversions go here
    return this.content as Array<$InferMessageContent<TStructure, "ai">>;
  }

  /**
   * Gets the combined text content from all text-type content blocks.
   * Filters out non-text content blocks and concatenates the text from remaining blocks.
   *
   * @returns The concatenated text content of the message
   *
   * @example
   * ```ts
   * const message = new SystemMessage([
   *   { type: "text", text: "You are a helpful " },
   *   { type: "text", text: "assistant." }
   * ]);
   * console.log(message.text); // "You are a helpful assistant."
   * ```
   */
  get text(): string {
    if (typeof this.content === "string") {
      return this.content;
    }
    const content: Array<
      $InferMessageContent<$StandardMessageStructure, "system">
    > = this.contentBlocks;
    return content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  }

  /**
   * Type guard to check if an unknown value is a SystemMessage instance.
   *
   * This method performs a runtime check to determine whether the provided
   * value is a valid SystemMessage instance by checking for the appropriate
   * branding and message type.
   *
   * @param message - The unknown value to check
   * @returns true if the message is a SystemMessage instance, false otherwise
   *
   * @example
   * ```ts
   * const unknownMessage: unknown = new SystemMessage("You are a helpful assistant");
   *
   * if (SystemMessage.isInstance(unknownMessage)) {
   *   // TypeScript now knows unknownMessage is a SystemMessage
   *   console.log(unknownMessage.text); // "You are a helpful assistant"
   *   console.log(unknownMessage.type); // "system"
   * }
   * ```
   */
  static isInstance(message: unknown): message is SystemMessage {
    return isBrandedMessage(message, "system");
  }
}

/** Parameters for creating a ToolMessage */
export type ToolMessageParams<
  TStructure extends $MessageStructure = $StandardMessageStructure
> = {
  id?: string;
  name?: string;
  toolCallId: string;
  status: "success" | "error";
  content: string | Iterable<BaseContentBlock>;
  metadata?: $InferMessageProperty<TStructure, "tool", "metadata">;
};

/**
 * Represents a message from a tool execution or tool call result.
 *
 * This class implements the Message interface specifically for tool-generated content,
 * providing type-safe access to tool execution results and associated metadata.
 * Tool messages are typically used to represent the output or response from a tool
 * that was called during a conversation or workflow.
 *
 * @template TStructure - The message structure type that defines the content and property types.
 *                        Defaults to $StandardMessageStructure.
 *
 * @example
 * ```ts
 * // Create a tool message with simple text result
 * const toolMessage = new ToolMessage("Calculation result: 42");
 *
 * // Create a tool message with structured content
 * const toolMessageWithContent = new ToolMessage([
 *   { type: "text", text: "Search results: " },
 *   { type: "text", text: "Found 5 matching items" }
 * ]);
 *
 * // Access the combined text content
 * console.log(toolMessage.text); // "Calculation result: 42"
 * ```
 */
export class ToolMessage<
  TStructure extends $MessageStructure = $StandardMessageStructure
> implements Message, $BrandedMessage
{
  /** @internal */
  readonly [__MESSAGE_CLASS] = true as const;

  /** The message type, always "tool" for tool messages */
  readonly type = "tool" as const;

  /** Unique identifier for this message */
  id?: string;

  /** Optional name/identifier for the tool that generated this message */
  name?: string;

  /** The ID of the tool call that this message is associated with */
  toolCallId: string;

  /** The status of the tool call */
  status: "success" | "error";

  /** Array of content blocks that make up the message content */
  content: MessageContent;

  /** Metadata associated with the tool message, as defined by the message structure */
  metadata?: $InferMessageProperty<TStructure, "tool", "metadata">;

  constructor(
    params: string | Iterable<BaseContentBlock> | ToolMessageParams<TStructure>
  ) {
    if (typeof params === "string") {
      // new ToolMessage("Hello")
      this.content = params;
    } else if (Symbol.iterator in params) {
      // new ToolMessage([{ type: "text", text: "Hello" }])
      this.content = Array.from(params);
    } else {
      // new ToolMessage({ ... })
      this.id = params.id ?? "";
      this.name = params.name;
      this.toolCallId = params.toolCallId;
      this.status = params.status;
      this.metadata = params.metadata;
      if (typeof params.content === "string") {
        // new ToolMessage({ content: "Hello" })
        this.content = params.content;
      } else {
        // new ToolMessage({ content: [{ type: "text", text: "Hello" }] })
        this.content = Array.from(params.content);
      }
    }
  }

  get contentBlocks(): Array<$InferMessageContent<TStructure, "ai">> {
    // TODO: v0 conversions go here
    return this.content as Array<$InferMessageContent<TStructure, "ai">>;
  }

  /**
   * Gets the combined text content from all text-type content blocks.
   * Filters out non-text content blocks and concatenates the text from remaining blocks.
   *
   * @returns The concatenated text content of the message representing the tool result
   *
   * @example
   * ```ts
   * const toolMessage = new ToolMessage({
   *   toolCallId: "call_123",
   *   status: "success",
   *   content: [
   *     { type: "text", text: "Calculation result: " },
   *     { type: "text", text: "42" }
   *   ]
   * });
   * console.log(toolMessage.result); // "Calculation result: 42"
   * ```
   */
  get result(): string {
    if (typeof this.content === "string") {
      return this.content;
    }
    const content: Array<
      $InferMessageContent<$StandardMessageStructure, "tool">
    > = this.contentBlocks;
    return content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  }

  /**
   * Type guard to check if an unknown value is a ToolMessage instance.
   *
   * This method performs runtime type checking to determine if the provided
   * value is a valid ToolMessage instance by checking for the branded message
   * marker and the correct message type.
   *
   * @param message - The unknown value to check
   * @returns true if the message is a ToolMessage instance, false otherwise
   *
   * @example
   * ```ts
   * const message: unknown = new ToolMessage({
   *   toolCallId: "call_123",
   *   status: "success",
   *   content: [{ type: "text", text: "Success!" }]
   * });
   *
   * if (ToolMessage.isInstance(message)) {
   *   // TypeScript now knows message is a ToolMessage
   *   console.log(message.toolCallId); // "call_123"
   *   console.log(message.result); // "Success!"
   * }
   * ```
   */
  static isInstance(message: unknown): message is ToolMessage {
    return isBrandedMessage(message, "tool");
  }
}

/**
 * A tuple representation of a message consisting of a role and content.
 *
 * This type provides a compact way to represent messages as a two-element array,
 * where the first element is the message type/role and the second element is the content.
 * The content can be either a simple string or an array of structured content blocks.
 *
 * @template TStructure - The message structure type that defines the content and property types.
 *                        Defaults to $StandardMessageStructure.
 * @template TRole - The message type/role that determines the content structure.
 *                   Defaults to $MessageType (any valid message type).
 *
 * @example
 * ```ts
 * // Simple text message tuple
 * const humanTuple: MessageTuple = ["human", "Hello, world!"];
 *
 * // AI message tuple with structured content
 * const aiTuple: MessageTuple = [
 *   "ai",
 *   [
 *     { type: "text", text: "Here's the answer:" },
 *     { type: "tool_call", name: "search", args: { query: "example" } }
 *   ]
 * ];
 *
 * // Custom structure message tuple
 * const customTuple: MessageTuple<CustomStructure, "ai"> = [
 *   "ai",
 *   [{ type: "text", text: "Custom AI response" }]
 * ];
 * ```
 */
export type MessageTuple<TRole extends $MessageType = $MessageType> = [
  TRole,
  string | Iterable<BaseContentBlock>
];

/**
 * Type guard to check if a value is a valid MessageTuple object.
 *
 * @param message - The value to check
 * @returns true if the value is a valid MessageTuple object, false otherwise
 */
export function isMessageTuple(message: unknown): message is MessageTuple {
  return (
    Array.isArray(message) &&
    message.length === 2 &&
    typeof message[0] === "string" &&
    (typeof message[1] === "string" || Symbol.iterator in message[1])
  );
}

/**
 * Converts a MessageTuple object to a Message object.
 *
 * @param message - The MessageTuple object to convert
 * @returns A Message object if the conversion is successful, undefined otherwise
 */
export function convertMessageTuple<TStructure extends $MessageStructure>(
  message: MessageTuple
): Message | undefined {
  const [role, content] = message;
  switch (role.toLowerCase()) {
    case "ai":
      return new AIMessage<TStructure>(content);
    case "human":
      return new HumanMessage<TStructure>(content);
    case "system":
      return new SystemMessage<TStructure>(content);
    case "tool":
      return new ToolMessage<TStructure>(content);
    default: {
      const normalizedContent = iife(() => {
        if (typeof content === "string") {
          return [
            { type: "text", text: content } as $InferMessageContent<
              TStructure,
              typeof role
            >,
          ];
        }
        if (Symbol.iterator in content) {
          return Array.from(content);
        }
        return content;
      });
      return {
        type: role,
        id: "", // TODO: generate a random id
        content: normalizedContent,
      };
    }
  }
}

/**
 * A union type representing various formats that can be used to represent a message.
 *
 * This type provides flexibility in how messages can be specified, allowing for different
 * input formats that can be normalized into a standard Message object. It supports:
 * - Simple string content (automatically converted to a human message)
 * - Full Message objects with complete structure and metadata
 * - Compact MessageTuple format for concise message representation
 * - Serialized constructor format for message reconstruction (legacy)
 *
 * @example
 * ```ts
 * // Simple string - becomes a human message
 * const stringMessage: MessageLike = "Hello, world!";
 *
 * // Message class
 * const fullMessage: MessageLike = new HumanMessage("Hello, world!");
 *
 * // Tuple format
 * const tupleMessage: MessageLike = ["human", "Hello, world!"];
 *
 * // Serialized constructor (for deserialization)
 * const serializedMessage: MessageLike = {
 *   lc: 1,
 *   type: "constructor",
 *   id: ["langchain", "schema", "messages", "HumanMessage"],
 *   kwargs: { content: "Hello, world!" }
 * };
 * ```
 */
export type MessageLike =
  | string
  | Message
  | MessageTuple
  | SerializedConstructor;

/**
 * Type guard to check if a value is a valid MessageLike object.
 *
 * @param message - The value to check
 * @returns true if the value is a valid MessageLike object, false otherwise
 */
export function isMessageLike(message: unknown): message is MessageLike {
  // TODO: add `SerializedConstructor` guard
  return (
    typeof message === "string" || isMessage(message) || isMessageTuple(message)
  );
}

/**
 * Converts a MessageLike object to a Message object.
 *
 * @param message - The MessageLike object to convert
 * @returns A Message object if the conversion is successful, undefined otherwise
 */
export function convertMessageLike<TStructure extends $MessageStructure>(
  message: MessageLike
): Message | undefined {
  if (typeof message === "string") {
    return new HumanMessage<TStructure>(message);
  }
  if (isMessage(message)) {
    return message;
  }
  if (isMessageTuple(message)) {
    return convertMessageTuple(message);
  }
  // `SerializedConstructor`
  if (message.lc === 1) {
    // TODO: implement
    throw new Error("not implemented");
  }
  return undefined;
}
