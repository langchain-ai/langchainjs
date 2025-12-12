import { addLangChainErrorFields } from "../errors/index.js";
import { SerializedConstructor } from "../load/serializable.js";
import { _isToolCall } from "../tools/utils.js";
import { parsePartialJson } from "../utils/json.js";
import { AIMessage, AIMessageChunk, AIMessageChunkFields } from "./ai.js";
import {
  BaseMessageLike,
  BaseMessage,
  isBaseMessage,
  StoredMessage,
  StoredMessageV1,
  BaseMessageFields,
  _isMessageFieldWithRole,
} from "./base.js";
import { ChatMessage, ChatMessageFields, ChatMessageChunk } from "./chat.js";
import {
  FunctionMessage,
  FunctionMessageChunk,
  FunctionMessageFields,
} from "./function.js";
import { HumanMessage, HumanMessageChunk } from "./human.js";
import { RemoveMessage } from "./modifier.js";
import { SystemMessage, SystemMessageChunk } from "./system.js";
import {
  InvalidToolCall,
  ToolCall,
  ToolCallChunk,
  ToolMessage,
  ToolMessageFields,
} from "./tool.js";

export type $Expand<T> = T extends infer U ? { [K in keyof U]: U[K] } : never;

/**
 * Extracts the explicitly declared keys from a type T.
 *
 * @template T - The type to extract keys from
 * @returns A union of keys that are not string, number, or symbol
 */
type $KnownKeys<T> = {
  [K in keyof T]: string extends K
    ? never
    : number extends K
    ? never
    : symbol extends K
    ? never
    : K;
}[keyof T];

/**
 * Detects if T has an index signature.
 *
 * @template T - The type to check for index signatures
 * @returns True if T has an index signature, false otherwise
 */
type $HasIndexSignature<T> = string extends keyof T
  ? true
  : number extends keyof T
  ? true
  : symbol extends keyof T
  ? true
  : false;

/**
 * Detects if T has an index signature and no known keys.
 *
 * @template T - The type to check for index signatures and no known keys
 * @returns True if T has an index signature and no known keys, false otherwise
 */
type $OnlyIndexSignatures<T> = $HasIndexSignature<T> extends true
  ? [$KnownKeys<T>] extends [never]
    ? true
    : false
  : false;

/**
 * Recursively merges two object types T and U, with U taking precedence over T.
 *
 * This utility type performs a deep merge of two object types:
 * - For keys that exist in both T and U:
 *   - If both values are objects (Record<string, unknown>), recursively merge them
 *   - Otherwise, U's value takes precedence
 * - For keys that exist only in T, use T's value
 * - For keys that exist only in U, use U's value
 *
 * @template T - The first object type to merge
 * @template U - The second object type to merge (takes precedence over T)
 *
 * @example
 * ```ts
 * type ObjectA = {
 *   shared: { a: string; b: number };
 *   onlyInA: boolean;
 * };
 *
 * type ObjectB = {
 *   shared: { b: string; c: Date };
 *   onlyInB: symbol;
 * };
 *
 * type Merged = $MergeObjects<ObjectA, ObjectB>;
 * // Result: {
 * //   shared: { a: string; b: string; c: Date };
 * //   onlyInA: boolean;
 * //   onlyInB: symbol;
 * // }
 * ```
 */
export type $MergeObjects<T, U> =
  // If U is purely index-signature based, prefer U as a whole
  $OnlyIndexSignatures<U> extends true
    ? U
    : // If T is purely index-signature based, prefer U as a whole (prevents leaking broad index signatures)
    $OnlyIndexSignatures<T> extends true
    ? U
    : {
        [K in keyof T | keyof U]: K extends keyof T
          ? K extends keyof U
            ? T[K] extends Record<string, unknown>
              ? U[K] extends Record<string, unknown>
                ? $MergeObjects<T[K], U[K]>
                : U[K]
              : U[K]
            : T[K]
          : K extends keyof U
          ? U[K]
          : never;
      };

/**
 * Merges two discriminated unions A and B based on a discriminator key (defaults to "type").
 * For each possible value of the discriminator across both unions:
 * - If B has a member with that discriminator value, use B's member
 * - Otherwise use A's member with that discriminator value
 * This effectively merges the unions while giving B's members precedence over A's members.
 *
 * @template A - First discriminated union type that extends Record<Key, PropertyKey>
 * @template B - Second discriminated union type that extends Record<Key, PropertyKey>
 * @template Key - The discriminator key property, defaults to "type"
 */
export type $MergeDiscriminatedUnion<
  A extends Record<Key, PropertyKey>,
  B extends Record<Key, PropertyKey>,
  Key extends PropertyKey = "type"
> = {
  // Create a mapped type over all possible discriminator values from both A and B
  [T in A[Key] | B[Key]]: [Extract<B, Record<Key, T>>] extends [never] // Check if B has a member with this discriminator value
    ? // If B doesn't have this discriminator value, use A's member
      Extract<A, Record<Key, T>>
    : // If B does have this discriminator value, merge A's and B's members (B takes precedence)
    [Extract<A, Record<Key, T>>] extends [never]
    ? Extract<B, Record<Key, T>>
    : $MergeObjects<Extract<A, Record<Key, T>>, Extract<B, Record<Key, T>>>;
  // Index into the mapped type with all possible discriminator values
  // This converts the mapped type back into a union
}[A[Key] | B[Key]];

export type Constructor<T> = new (...args: unknown[]) => T;

/**
 * Immediately-invoked function expression.
 *
 * @param fn - The function to execute
 * @returns The result of the function
 */
export const iife = <T>(fn: () => T) => fn();

function _coerceToolCall(
  toolCall: ToolCall | Record<string, unknown>
): ToolCall {
  if (_isToolCall(toolCall)) {
    return toolCall;
  } else if (
    typeof toolCall.id === "string" &&
    toolCall.type === "function" &&
    typeof toolCall.function === "object" &&
    toolCall.function !== null &&
    "arguments" in toolCall.function &&
    typeof toolCall.function.arguments === "string" &&
    "name" in toolCall.function &&
    typeof toolCall.function.name === "string"
  ) {
    // Handle OpenAI tool call format
    return {
      id: toolCall.id,
      args: JSON.parse(toolCall.function.arguments),
      name: toolCall.function.name,
      type: "tool_call",
    };
  } else {
    // TODO: Throw an error?
    return toolCall as unknown as ToolCall;
  }
}

function isSerializedConstructor(x: unknown): x is SerializedConstructor {
  return (
    typeof x === "object" &&
    x != null &&
    (x as SerializedConstructor).lc === 1 &&
    Array.isArray((x as SerializedConstructor).id) &&
    (x as SerializedConstructor).kwargs != null &&
    typeof (x as SerializedConstructor).kwargs === "object"
  );
}

function _constructMessageFromParams(
  params:
    | (BaseMessageFields & { type: string } & Record<string, unknown>)
    | SerializedConstructor
) {
  let type: string;
  let rest: BaseMessageFields & Record<string, unknown>;
  // Support serialized messages
  if (isSerializedConstructor(params)) {
    const className = params.id.at(-1);
    if (className === "HumanMessage" || className === "HumanMessageChunk") {
      type = "user";
    } else if (className === "AIMessage" || className === "AIMessageChunk") {
      type = "assistant";
    } else if (
      className === "SystemMessage" ||
      className === "SystemMessageChunk"
    ) {
      type = "system";
    } else if (
      className === "FunctionMessage" ||
      className === "FunctionMessageChunk"
    ) {
      type = "function";
    } else if (
      className === "ToolMessage" ||
      className === "ToolMessageChunk"
    ) {
      type = "tool";
    } else {
      type = "unknown";
    }
    rest = params.kwargs as BaseMessageFields;
  } else {
    const { type: extractedType, ...otherParams } = params;
    type = extractedType;
    rest = otherParams;
  }
  if (type === "human" || type === "user") {
    return new HumanMessage(rest);
  } else if (type === "ai" || type === "assistant") {
    const { tool_calls: rawToolCalls, ...other } = rest;
    if (!Array.isArray(rawToolCalls)) {
      return new AIMessage(rest);
    }
    const tool_calls = rawToolCalls.map(_coerceToolCall);
    return new AIMessage({ ...other, tool_calls });
  } else if (type === "system") {
    return new SystemMessage(rest);
  } else if (type === "developer") {
    return new SystemMessage({
      ...rest,
      additional_kwargs: {
        ...rest.additional_kwargs,
        __openai_role__: "developer",
      },
    });
  } else if (type === "tool" && "tool_call_id" in rest) {
    return new ToolMessage({
      ...rest,
      content: rest.content,
      tool_call_id: rest.tool_call_id as string,
      name: rest.name,
    });
  } else if (type === "remove" && "id" in rest && typeof rest.id === "string") {
    return new RemoveMessage({ ...rest, id: rest.id });
  } else {
    const error = addLangChainErrorFields(
      new Error(
        `Unable to coerce message from array: only human, AI, system, developer, or tool message coercion is currently supported.\n\nReceived: ${JSON.stringify(
          params,
          null,
          2
        )}`
      ),
      "MESSAGE_COERCION_FAILURE"
    );
    throw error;
  }
}

export function coerceMessageLikeToMessage(
  messageLike: BaseMessageLike
): BaseMessage {
  if (typeof messageLike === "string") {
    return new HumanMessage(messageLike);
  } else if (isBaseMessage(messageLike)) {
    return messageLike;
  }
  if (Array.isArray(messageLike)) {
    const [type, content] = messageLike;
    return _constructMessageFromParams({ type, content });
  } else if (_isMessageFieldWithRole(messageLike)) {
    const { role: type, ...rest } = messageLike;
    return _constructMessageFromParams({ ...rest, type });
  } else {
    return _constructMessageFromParams(messageLike);
  }
}

/**
 * This function is used by memory classes to get a string representation
 * of the chat message history, based on the message content and role.
 */
export function getBufferString(
  messages: BaseMessage[],
  humanPrefix = "Human",
  aiPrefix = "AI"
): string {
  const string_messages: string[] = [];
  for (const m of messages) {
    let role: string;
    if (m._getType() === "human") {
      role = humanPrefix;
    } else if (m._getType() === "ai") {
      role = aiPrefix;
    } else if (m._getType() === "system") {
      role = "System";
    } else if (m._getType() === "tool") {
      role = "Tool";
    } else if (m._getType() === "generic") {
      role = (m as ChatMessage).role;
    } else {
      throw new Error(`Got unsupported message type: ${m._getType()}`);
    }
    const nameStr = m.name ? `${m.name}, ` : "";
    const readableContent =
      typeof m.content === "string"
        ? m.content
        : JSON.stringify(m.content, null, 2);
    string_messages.push(`${role}: ${nameStr}${readableContent}`);
  }
  return string_messages.join("\n");
}

/**
 * Maps messages from an older format (V1) to the current `StoredMessage`
 * format. If the message is already in the `StoredMessage` format, it is
 * returned as is. Otherwise, it transforms the V1 message into a
 * `StoredMessage`. This function is important for maintaining
 * compatibility with older message formats.
 */
function mapV1MessageToStoredMessage(
  message: StoredMessage | StoredMessageV1
): StoredMessage {
  // TODO: Remove this mapper when we deprecate the old message format.
  if ((message as StoredMessage).data !== undefined) {
    return message as StoredMessage;
  } else {
    const v1Message = message as StoredMessageV1;
    return {
      type: v1Message.type,
      data: {
        content: v1Message.text,
        role: v1Message.role,
        name: undefined,
        tool_call_id: undefined,
      },
    };
  }
}

export function mapStoredMessageToChatMessage(message: StoredMessage) {
  const storedMessage = mapV1MessageToStoredMessage(message);
  switch (storedMessage.type) {
    case "human":
      return new HumanMessage(storedMessage.data);
    case "ai":
      return new AIMessage(storedMessage.data);
    case "system":
      return new SystemMessage(storedMessage.data);
    case "function":
      if (storedMessage.data.name === undefined) {
        throw new Error("Name must be defined for function messages");
      }
      return new FunctionMessage(storedMessage.data as FunctionMessageFields);
    case "tool":
      if (storedMessage.data.tool_call_id === undefined) {
        throw new Error("Tool call ID must be defined for tool messages");
      }
      return new ToolMessage(storedMessage.data as ToolMessageFields);
    case "generic": {
      if (storedMessage.data.role === undefined) {
        throw new Error("Role must be defined for chat messages");
      }
      return new ChatMessage(storedMessage.data as ChatMessageFields);
    }
    default:
      throw new Error(`Got unexpected type: ${storedMessage.type}`);
  }
}

/**
 * Transforms an array of `StoredMessage` instances into an array of
 * `BaseMessage` instances. It uses the `mapV1MessageToStoredMessage`
 * function to ensure all messages are in the `StoredMessage` format, then
 * creates new instances of the appropriate `BaseMessage` subclass based
 * on the type of each message. This function is used to prepare stored
 * messages for use in a chat context.
 */
export function mapStoredMessagesToChatMessages(
  messages: StoredMessage[]
): BaseMessage[] {
  return messages.map(mapStoredMessageToChatMessage);
}

/**
 * Transforms an array of `BaseMessage` instances into an array of
 * `StoredMessage` instances. It does this by calling the `toDict` method
 * on each `BaseMessage`, which returns a `StoredMessage`. This function
 * is used to prepare chat messages for storage.
 */
export function mapChatMessagesToStoredMessages(
  messages: BaseMessage[]
): StoredMessage[] {
  return messages.map((message) => message.toDict());
}

export function convertToChunk(message: BaseMessage) {
  const type = message._getType();
  if (type === "human") {
    return new HumanMessageChunk({ ...message });
  } else if (type === "ai") {
    let aiChunkFields: AIMessageChunkFields = {
      ...message,
    };
    if ("tool_calls" in aiChunkFields) {
      aiChunkFields = {
        ...aiChunkFields,
        tool_call_chunks: aiChunkFields.tool_calls?.map((tc) => ({
          ...tc,
          type: "tool_call_chunk",
          index: undefined,
          args: JSON.stringify(tc.args),
        })),
      };
    }
    return new AIMessageChunk({ ...aiChunkFields });
  } else if (type === "system") {
    return new SystemMessageChunk({ ...message });
  } else if (type === "function") {
    return new FunctionMessageChunk({ ...message });
  } else if (ChatMessage.isInstance(message)) {
    return new ChatMessageChunk({ ...message });
  } else {
    throw new Error("Unknown message type.");
  }
}

/**
 * Collapses an array of tool call chunks into complete tool calls.
 *
 * This function groups tool call chunks by their id and/or index, then attempts to
 * parse and validate the accumulated arguments for each group. Successfully parsed
 * tool calls are returned as valid `ToolCall` objects, while malformed ones are
 * returned as `InvalidToolCall` objects.
 *
 * @param chunks - An array of `ToolCallChunk` objects to collapse
 * @returns An object containing:
 *   - `tool_call_chunks`: The original input chunks
 *   - `tool_calls`: An array of successfully parsed and validated tool calls
 *   - `invalid_tool_calls`: An array of tool calls that failed parsing or validation
 *
 * @remarks
 * Chunks are grouped using the following matching logic:
 * - If a chunk has both an id and index, it matches chunks with the same id and index
 * - If a chunk has only an id, it matches chunks with the same id
 * - If a chunk has only an index, it matches chunks with the same index
 *
 * For each group, the function:
 * 1. Concatenates all `args` strings from the chunks
 * 2. Attempts to parse the concatenated string as JSON
 * 3. Validates that the result is a non-null object with a valid id
 * 4. Creates either a `ToolCall` (if valid) or `InvalidToolCall` (if invalid)
 */
export function collapseToolCallChunks(chunks: ToolCallChunk[]): {
  tool_call_chunks: ToolCallChunk[];
  tool_calls: ToolCall[];
  invalid_tool_calls: InvalidToolCall[];
} {
  const groupedToolCallChunks = chunks.reduce((acc, chunk) => {
    const matchedChunkIndex = acc.findIndex(([match]) => {
      // If chunk has an id and index, match if both are present
      if (
        "id" in chunk &&
        chunk.id &&
        "index" in chunk &&
        chunk.index !== undefined
      ) {
        return chunk.id === match.id && chunk.index === match.index;
      }
      // If chunk has an id, we match on id
      if ("id" in chunk && chunk.id) {
        return chunk.id === match.id;
      }
      // If chunk has an index, we match on index
      if ("index" in chunk && chunk.index !== undefined) {
        return chunk.index === match.index;
      }
      return false;
    });
    if (matchedChunkIndex !== -1) {
      acc[matchedChunkIndex].push(chunk);
    } else {
      acc.push([chunk]);
    }
    return acc;
  }, [] as ToolCallChunk[][]);

  const toolCalls: ToolCall[] = [];
  const invalidToolCalls: InvalidToolCall[] = [];
  for (const chunks of groupedToolCallChunks) {
    let parsedArgs: Record<string, unknown> | null = null;
    const name = chunks[0]?.name ?? "";
    const joinedArgs = chunks
      .map((c) => c.args || "")
      .join("")
      .trim();
    const argsStr = joinedArgs.length ? joinedArgs : "{}";
    const id = chunks[0]?.id;
    try {
      parsedArgs = parsePartialJson(argsStr);
      if (
        !id ||
        parsedArgs === null ||
        typeof parsedArgs !== "object" ||
        Array.isArray(parsedArgs)
      ) {
        throw new Error("Malformed tool call chunk args.");
      }
      toolCalls.push({
        name,
        args: parsedArgs,
        id,
        type: "tool_call",
      });
    } catch {
      invalidToolCalls.push({
        name,
        args: argsStr,
        id,
        error: "Malformed args.",
        type: "invalid_tool_call",
      });
    }
  }
  return {
    tool_call_chunks: chunks,
    tool_calls: toolCalls,
    invalid_tool_calls: invalidToolCalls,
  };
}
