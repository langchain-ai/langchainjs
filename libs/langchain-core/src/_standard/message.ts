import { type ContentBlock } from "./content/index.js";
import { $Merge, $MergeDiscriminatedUnion } from "./utils.js";

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
 * @property [tools] - Optional set of tools that can be used within messages.
 *   Tools are defined as a map of tool names to their input/output definitions.
 *
 * @property [contentBlocks] - Optional content blocks for different message types.
 *   Maps message types (excluding "tool") to their content block definitions.
 *   Content blocks can contain text, images, or other media types.
 *
 * @property [properties] - Optional properties for different message types.
 *   Maps message types to arbitrary property objects.
 *   Used to attach metadata or other information to specific message types.
 *
 * @example
 * ```ts
 * // Basic message structure with just content blocks
 * interface SimpleMessageStructure extends $MessageStructure {
 *   contentBlocks: {
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
 *   contentBlocks: {
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
  readonly contentBlocks?: Partial<{
    [key in Exclude<$MessageType, "tool">]: ContentBlock;
  }>;

  /**
   * Optional mapping of message types to arbitrary property objects.
   * Allows attaching custom metadata or other information to specific message types.
   * Properties are typed as Record<string, unknown> to allow flexible property definitions.
   */
  readonly properties?: Partial<{
    [key in $MessageType]: Record<string, unknown>;
  }>;

  [STANDARD_MESSAGE_STRUCTURE_TYPE]?: never;
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
 *   contentBlocks: {
 *     human: ContentBlock.Text;
 *   };
 *   properties: {
 *     ai: { confidence: number };
 *   }
 * }
 *
 * // Structure B allows images in human messages and has a model property on AI messages
 * interface StructureB extends $MessageStructure {
 *   contentBlocks: {
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
export interface $MergeMessageStructure<
  A extends $MessageStructure,
  B extends $MessageStructure
> {
  tools: $Merge<A["tools"], B["tools"]>;
  contentBlocks: {
    [K in keyof (A["contentBlocks"] &
      B["contentBlocks"])]: K extends keyof A["contentBlocks"] &
      keyof B["contentBlocks"]
      ? $MergeDiscriminatedUnion<
          NonNullable<A["contentBlocks"][K]> & Record<"type", PropertyKey>,
          NonNullable<B["contentBlocks"][K]> & Record<"type", PropertyKey>,
          "type"
        >
      : K extends keyof A["contentBlocks"]
      ? A["contentBlocks"][K]
      : K extends keyof B["contentBlocks"]
      ? B["contentBlocks"][K]
      : never;
  };
  properties: {
    [K in keyof (A["properties"] &
      B["properties"])]: K extends keyof A["properties"] & keyof B["properties"]
      ? $Merge<NonNullable<A["properties"]>[K], NonNullable<B["properties"]>[K]>
      : K extends keyof A["properties"]
      ? A["properties"][K]
      : K extends keyof B["properties"]
      ? B["properties"][K]
      : never;
  };
}

/**
 * Gets all possible message types from a message structure
 *
 * This is used internally to get the possible message types for a given message structure.
 *
 * If a message structure has no tools, it will not include the "tool" type. If a message structure
 * has arbitrary types defined in either contentBlocks or properties, it will include those types
 * as available message types.
 *
 * @template TStructure - The message structure to get types from
 * @example
 * ```ts
 * interface MyStructure extends $MessageStructure {
 *   contentBlocks: { human: ContentBlock.Text };
 *   properties: { ai: { confidence: number } };
 *   tools: Tools.ToolCall;
 * }
 *
 * type Types = $MessageStructureTypes<MyStructure>;
 * // Types = "human" | "ai" | "tool"
 * ```
 */
export type $MessageStructureTypes<TStructure extends $MessageStructure> =
  | keyof TStructure["contentBlocks"]
  | keyof TStructure["properties"]
  | (TStructure["tools"] extends undefined ? never : "tool");

/**
 * Standard message structured used to define the most basic message structure that's
 * used throughout the library.
 *
 * This is also the message structure that's used when a message structure is not provided.
 */

const STANDARD_MESSAGE_STRUCTURE_TYPE = Symbol.for(
  "langchain.message.std-structure"
);

export type $StandardMessageStructure = $MessageStructure & {
  /** @internal Discriminator to give TS a hint when evaluating if a type is a standard message structure */
  [STANDARD_MESSAGE_STRUCTURE_TYPE]: never;
  contentBlocks: {
    /** Text content for AI messages */
    ai: ContentBlock.Text;
    /** Text content for human messages */
    human: ContentBlock.Text;
    /** Text content for system messages */
    system: ContentBlock.Text;
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
 * Applies message-specific properties to a base object based on the message type and structure.
 *
 * This type utility merges a base object with any additional properties defined for a specific
 * message type in the message structure. If no properties are defined for the message type,
 * the base object is returned unchanged.
 *
 * @template TStructure - The message structure type that defines available message types and their properties
 * @template TMessageType - The specific message type to get properties for
 * @template TObject - The base object type to merge properties into
 * @returns The base object merged with any message-specific properties defined in the structure
 */
export type $ApplyMessageProperties<
  TStructure extends $MessageStructure,
  TMessageType extends $MessageStructureTypes<TStructure>,
  TObject extends Record<string, unknown>
> = TObject &
  (TMessageType extends keyof TStructure["properties"]
    ? TStructure["properties"][TMessageType]
    : Record<string, unknown>);

/**
 * Defines the shape of a base message in a conversation, handling different message types and their properties.
 *
 * @template TStructure - The message structure definition that specifies available message types and their properties
 * @template TRole - The role or type of the message sender, must be one of the message types defined in TStructure
 *
 * This type creates a discriminated union based on the message role (TRole) with specific handling for:
 * - Tool messages: Includes tool-specific properties like toolCallId, status, and tool-specific output types
 * - Content block messages: Handles regular message content with optional tool call blocks
 *
 * The resulting type ensures type safety and proper structure for different kinds of messages
 * while maintaining flexibility for custom message types and properties.
 */
export type BaseMessageShape<
  TStructure extends $MessageStructure = $StandardMessageStructure,
  TRole extends $MessageStructureTypes<TStructure> = $MessageStructureTypes<TStructure>
> = {
  // Map over each message type in the role (TRole)
  [TMessageType in TRole]: TMessageType extends "tool"
    ? // If this is a tool message...
      TStructure["tools"] extends $MessageToolSet
      ? // And if the structure has a tools definition...
        {
          // Create a mapped type over all tool names, applying the structure's defined
          // properties to the inner message definition
          [K in keyof TStructure["tools"]]: $ApplyMessageProperties<
            TStructure,
            TMessageType,
            {
              type: "tool";
              toolCallId: string; // Unique ID for this tool call
              status: "success" | "error"; // Whether the tool call succeeded
              name?: K; // Optional name of the specific tool
              content: TStructure["tools"][K] extends $MessageToolDefinition
                ? TStructure["tools"][K]["output"] // Use the tool's defined output type
                : unknown; // Fallback if no output type defined
            }
          >;
        }[keyof TStructure["tools"]] // Index to convert mapped type to union
      : never // If no tools defined, this type is never
    : // If this is not a tool message, but is a valid content block type...
    TMessageType extends keyof TStructure["contentBlocks"]
    ? // Apply the structure's defined properties to the inner message definition
      $ApplyMessageProperties<
        TStructure,
        TMessageType,
        {
          type: TMessageType;
          content: Array<
            // If tools are undefined, use just the content block type
            TStructure["tools"] extends undefined
              ? TStructure["contentBlocks"][TMessageType]
              : // Otherwise merge the existing content block type with a tool call block type
                $MergeDiscriminatedUnion<
                  NonNullable<TStructure["contentBlocks"][TMessageType]> &
                    Record<"type", PropertyKey>,
                  // Pull the tool call block type from the structure
                  $MessageToolCallBlock<TStructure>,
                  "type"
                >
          >;
        }
      >
    : never; // If neither tool nor content block type, this type is never
}[TRole];

/**
 * Base message type that represents a message in a conversation.
 * This serves as the foundation for specific message types like AI, Human, System, and Tool messages.
 *
 * @template TStructure - The message structure definition
 * @template TRole - The role of the message sender (ai, human, system, or tool)
 */
export type BaseMessage<
  TStructure extends $MessageStructure = $StandardMessageStructure,
  TRole extends $MessageStructureTypes<
    $NormalizedMessageStructure<TStructure>
  > = $MessageStructureTypes<$NormalizedMessageStructure<TStructure>>
> = BaseMessageShape<$NormalizedMessageStructure<TStructure>, TRole>;

/**
 * Represents a message from an AI assistant in a conversation.
 * Contains the AI's response content and any associated metadata.
 *
 * @template TStructure - The message structure definition
 */
export type AIMessage<
  TStructure extends $MessageStructure = $StandardMessageStructure
> = BaseMessage<TStructure, "ai">;

/**
 * Represents a message from a human user in a conversation.
 * Contains the user's input content and any associated metadata.
 *
 * @template TStructure - The message structure definition
 */
export type HumanMessage<
  TStructure extends $MessageStructure = $StandardMessageStructure
> = BaseMessage<TStructure, "human">;

/**
 * Represents a system message in a conversation.
 * Typically used for providing context, instructions, or controlling conversation behavior.
 *
 * @template TStructure - The message structure definition
 */
export type SystemMessage<
  TStructure extends $MessageStructure = $StandardMessageStructure
> = BaseMessage<TStructure, "system">;

/**
 * Represents a message from a tool in a conversation.
 * Contains the tool's output, status, and metadata about the tool execution.
 *
 * @template TStructure - The message structure definition
 */
export type ToolMessage<
  TStructure extends $MessageStructure = $StandardMessageStructure
> = "tool" extends $MessageStructureTypes<TStructure>
  ? BaseMessage<TStructure, "tool">
  : {
      type: "tool";
      toolCallId: string;
      status: "success" | "error";
      name?: string;
      content: unknown;
    };
