import { ContentBlock } from "./content";
import { $MergeDiscriminatedUnion, $MergeObjects } from "./utils";

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

/**
 * Represents a message object that organize context for an LLM.
 *
 * @template TStructure - The message structure type that defines the content and property types.
 *                        Defaults to $StandardMessageStructure.
 * @template TRole - The message role/type (e.g., "ai", "human", "system", "tool").
 *                   Defaults to $MessageType which includes all possible message types.
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
 *
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
export interface Message<
  TStructure extends $MessageStructure = $StandardMessageStructure,
  TRole extends $MessageType = $MessageType
> {
  /** Unique identifier for this message */
  id: string;
  /** Optional name/identifier for the entity that created this message */
  name?: string;
  /** The message type/role, determines the content structure and available properties */
  readonly type: TRole;
  /** Array of content blocks that make up the message content, typed based on the structure and role */
  content: Array<$InferMessageContent<TStructure, TRole>>;
}

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
 * // Create an AI message with structured content
 * const aiMessageWithContent = new AIMessage([
 *   { type: "text", text: "Here's the answer: " },
 *   { type: "text", text: "42" }
 * ]);
 *
 * // Access the combined text content
 * console.log(aiMessage.text); // "Hello, how can I help you?"
 * ```
 */
export class AIMessage<
  TStructure extends $MessageStructure = $StandardMessageStructure
> implements Message<TStructure, "ai">
{
  /** Unique identifier for this message */
  id: string;
  /** Optional name/identifier for the AI that generated this message */
  name?: string;
  /** The message type, always "ai" for AI messages */
  readonly type: "ai" = "ai";
  /** Array of content blocks that make up the message content */
  content: Array<$InferMessageContent<TStructure, "ai">>;
  /** Metadata about the AI model response (model provider, model name, etc.) */
  responseMetadata: $InferMessageProperty<TStructure, "ai", "responseMetadata">;
  /** Usage statistics for the AI response (token counts, etc.) */
  usageMetadata: $InferMessageProperty<TStructure, "ai", "usageMetadata">;

  /**
   * Creates an AI message with simple text content.
   * @param text - The text content for the message
   */
  constructor(text: string);
  /**
   * Creates an AI message with structured content blocks.
   * @param content - Array of content blocks for the message
   */
  constructor(content: Array<$InferMessageContent<TStructure, "ai">>);
  constructor(
    textOrContent: string | Array<$InferMessageContent<TStructure, "ai">>
  ) {
    if (typeof textOrContent === "string") {
      this.content = [
        { type: "text", text: textOrContent } as $InferMessageContent<
          TStructure,
          "ai"
        >,
      ];
    } else {
      this.content = textOrContent;
    }
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
  get text() {
    const content = this.content as Array<
      $InferMessageContent<$StandardMessageStructure, "ai">
    >;
    return content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  }
}

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
> implements Message<TStructure, "human">
{
  /** Unique identifier for the message */
  id: string;
  /** Optional name identifier for the message sender */
  name?: string;
  /** The message type, always "human" for HumanMessage instances */
  readonly type: "human" = "human";
  /** Array of content blocks that make up the message content */
  content: Array<$InferMessageContent<TStructure, "human">>;
  /** Metadata associated with the human message, as defined by the message structure */
  metadata: $InferMessageProperty<TStructure, "human", "metadata">;

  /**
   * Creates a human message with simple text content.
   * @param text - The text content for the message
   */
  constructor(text: string);
  /**
   * Creates a human message with structured content blocks.
   * @param content - Array of content blocks for the message
   */
  constructor(content: Array<$InferMessageContent<TStructure, "human">>);
  constructor(
    textOrContent: string | Array<$InferMessageContent<TStructure, "human">>
  ) {
    if (typeof textOrContent === "string") {
      this.content = [
        { type: "text", text: textOrContent } as $InferMessageContent<
          TStructure,
          "human"
        >,
      ];
    } else {
      this.content = textOrContent;
    }
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
  get text() {
    const content = this.content as Array<
      $InferMessageContent<$StandardMessageStructure, "human">
    >;
    return content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  }
}

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
> implements Message<TStructure, "system">
{
  /** Unique identifier for this message */
  id: string;
  /** Optional name/identifier for the system that generated this message */
  name?: string;
  /** The message type, always "system" for system messages */
  readonly type: "system" = "system";
  /** Array of content blocks that make up the message content */
  content: Array<$InferMessageContent<TStructure, "system">>;
  /** Metadata associated with the system message */
  metadata: $InferMessageProperty<TStructure, "system", "metadata">;

  /**
   * Creates a system message with simple text content.
   * @param text - The text content for the message
   */
  constructor(text: string);
  /**
   * Creates a system message with structured content blocks.
   * @param content - Array of content blocks for the message
   */
  constructor(content: Array<$InferMessageContent<TStructure, "system">>);
  constructor(
    textOrContent: string | Array<$InferMessageContent<TStructure, "system">>
  ) {
    if (typeof textOrContent === "string") {
      this.content = [
        { type: "text", text: textOrContent } as $InferMessageContent<
          TStructure,
          "system"
        >,
      ];
    } else {
      this.content = textOrContent;
    }
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
  get text() {
    const content = this.content as Array<
      $InferMessageContent<$StandardMessageStructure, "system">
    >;
    return content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  }
}

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
> implements Message<TStructure, "tool">
{
  /** Unique identifier for this message */
  id: string;
  /** Optional name/identifier for the tool that generated this message */
  name?: string;
  /** The message type, always "tool" for tool messages */
  readonly type: "tool" = "tool";
  /** Array of content blocks that make up the message content */
  content: Array<$InferMessageContent<TStructure, "tool">>;
  /** Metadata associated with the tool message, as defined by the message structure */
  metadata: $InferMessageProperty<TStructure, "tool", "metadata">;

  /**
   * Gets the combined text content from all text-type content blocks.
   * Filters out non-text content blocks and concatenates the text from remaining blocks.
   *
   * @returns The concatenated text content of the message
   *
   * @example
   * ```ts
   * const message = new ToolMessage([
   *   { type: "text", text: "Result: " },
   *   { type: "text", text: "Success" }
   * ]);
   * console.log(message.text); // "Result: Success"
   * ```
   */
  get text() {
    const content = this.content as Array<
      $InferMessageContent<$StandardMessageStructure, "tool">
    >;
    return content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  }
}
