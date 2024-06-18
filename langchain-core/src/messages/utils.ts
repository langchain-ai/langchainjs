import { BaseDocumentTransformer } from "../documents/transformers.js";
import { BaseLanguageModel } from "../language_models/base.js";
import { Runnable, RunnableLambda } from "../runnables/base.js";
import { AIMessage, AIMessageChunk, AIMessageChunkFields } from "./ai.js";
import {
  BaseMessageLike,
  BaseMessage,
  isBaseMessage,
  StoredMessage,
  StoredMessageV1,
  MessageType,
  BaseMessageFields,
  BaseMessageChunk,
} from "./base.js";
import {
  ChatMessage,
  ChatMessageFieldsWithRole,
  ChatMessageChunk,
} from "./chat.js";
import {
  FunctionMessage,
  FunctionMessageFieldsWithName,
  FunctionMessageChunk,
} from "./function.js";
import { HumanMessage, HumanMessageChunk } from "./human.js";
import { SystemMessage, SystemMessageChunk } from "./system.js";
import {
  ToolMessage,
  ToolMessageFieldsWithToolCallId,
  ToolMessageChunk,
} from "./tool.js";

export function coerceMessageLikeToMessage(
  messageLike: BaseMessageLike
): BaseMessage {
  if (typeof messageLike === "string") {
    return new HumanMessage(messageLike);
  } else if (isBaseMessage(messageLike)) {
    return messageLike;
  }
  const [type, content] = messageLike;
  if (type === "human" || type === "user") {
    return new HumanMessage({ content });
  } else if (type === "ai" || type === "assistant") {
    return new AIMessage({ content });
  } else if (type === "system") {
    return new SystemMessage({ content });
  } else {
    throw new Error(
      `Unable to coerce message from array: only human, AI, or system message coercion is currently supported.`
    );
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
    } else if (m._getType() === "function") {
      role = "Function";
    } else if (m._getType() === "tool") {
      role = "Tool";
    } else if (m._getType() === "generic") {
      role = (m as ChatMessage).role;
    } else {
      throw new Error(`Got unsupported message type: ${m._getType()}`);
    }
    const nameStr = m.name ? `${m.name}, ` : "";
    string_messages.push(`${role}: ${nameStr}${m.content}`);
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
      return new FunctionMessage(
        storedMessage.data as FunctionMessageFieldsWithName
      );
    case "tool":
      if (storedMessage.data.tool_call_id === undefined) {
        throw new Error("Tool call ID must be defined for tool messages");
      }
      return new ToolMessage(
        storedMessage.data as ToolMessageFieldsWithToolCallId
      );
    case "chat": {
      if (storedMessage.data.role === undefined) {
        throw new Error("Role must be defined for chat messages");
      }
      return new ChatMessage(storedMessage.data as ChatMessageFieldsWithRole);
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
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
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
          index: undefined,
          args: JSON.stringify(tc.args),
        })),
      };
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new AIMessageChunk({ ...aiChunkFields });
  } else if (type === "system") {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new SystemMessageChunk({ ...message });
  } else if (type === "function") {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new FunctionMessageChunk({ ...message });
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
  } else if (ChatMessage.isInstance(message)) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new ChatMessageChunk({ ...message });
  } else {
    throw new Error("Unknown message type.");
  }
}

const _isMessageType = (
  msg: BaseMessage,
  types: (MessageType | BaseMessage)[]
) => {
  const typesAsStrings = [
    ...new Set<string>(
      types?.map((t) => {
        if (typeof t === "string") {
          return t;
        }
        return t._getType();
      })
    ),
  ];
  const msgType = msg._getType();
  return typesAsStrings.some((t) => t === msgType);
};

/**
 * Filter messages based on name, type or id.
 *
 * @param {BaseMessage[]} messages Sequence of BaseMessage objects to filter.
 * @param options Optional filtering options.
 * @param {string[] | undefined} options.includeNames Message names to include.
 * @param {string[] | undefined} options.excludeNames Messages names to exclude.
 * @param {(MessageType | BaseMessage)[] | undefined} options.includeTypes Message types to include. Can be specified as string names (e.g.
 *     "system", "human", "ai", ...) or as BaseMessage classes (e.g.
 *     SystemMessage, HumanMessage, AIMessage, ...).
 * @param {(MessageType | BaseMessage)[] | undefined} options.excludeTypes Message types to exclude. Can be specified as string names (e.g.
 *     "system", "human", "ai", ...) or as BaseMessage classes (e.g.
 *     SystemMessage, HumanMessage, AIMessage, ...).
 * @param {string[] | undefined} options.includeIds Message IDs to include.
 * @param {string[] | undefined} options.excludeIds Message IDs to exclude.
 * @returns A list of Messages that meets at least one of the include conditions and none
 *     of the exclude conditions. If no include conditions are specified then
 *     anything that is not explicitly excluded will be included.
 * @throws {Error} If two incompatible arguments are provided.
 *
 * @example
 * ```typescript
 * import { filterMessages, AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
 *
 * const messages = [
 *   new SystemMessage("you're a good assistant."),
 *   new HumanMessage({ content: "what's your name", id: "foo", name: "example_user" }),
 *   new AIMessage({ content: "steve-o", id: "bar", name: "example_assistant" }),
 *   new HumanMessage({ content: "what's your favorite color", id: "baz" }),
 *   new AIMessage({ content: "silicon blue" , id: "blah" }),
 * ];
 *
 * filterMessages(messages, {
 *   includeNames: ["example_user", "example_assistant"],
 *   includeTypes: ["system"],
 *   excludeIds: ["bar"],
 * });
 * ```
 *
 * The above example would return:
 * ```typescript
 * [
 *   new SystemMessage("you're a good assistant."),
 *   new HumanMessage({ content: "what's your name", id: "foo", name: "example_user" }),
 * ]
 * ```
 */
export function filterMessages(
  messages: BaseMessage[],
  options: {
    includeNames?: string[];
    excludeNames?: string[];
    includeTypes?: (MessageType | BaseMessage)[];
    excludeTypes?: (MessageType | BaseMessage)[];
    includeIds?: string[];
    excludeIds?: string[];
  } = {}
): BaseMessage[] {
  const {
    includeNames,
    excludeNames,
    includeTypes,
    excludeTypes,
    includeIds,
    excludeIds,
  } = options;

  const filtered: BaseMessage[] = [];

  for (const msg of messages) {
    if (excludeNames && msg.name && excludeNames.includes(msg.name)) {
      continue;
    } else if (excludeTypes && _isMessageType(msg, excludeTypes)) {
      continue;
    } else if (excludeIds && msg.id && excludeIds.includes(msg.id)) {
      continue;
    }

    // default to inclusion when no inclusion criteria given.
    if (!(includeTypes || includeIds || includeNames)) {
      filtered.push(msg);
    } else if (
      includeNames &&
      msg.name &&
      includeNames.some((iName) => iName === msg.name)
    ) {
      filtered.push(msg);
    } else if (includeTypes && _isMessageType(msg, includeTypes)) {
      filtered.push(msg);
    } else if (includeIds && msg.id && includeIds.some((id) => id === msg.id)) {
      filtered.push(msg);
    }
  }

  return filtered;
}

/**
 * Merge consecutive Messages of the same type.
 *
 * **NOTE**: ToolMessages are not merged, as each has a distinct tool call id that
 * can't be merged.
 *
 * @param {BaseMessage[]} messages Sequence of Message-like objects to merge.
 * @returns List of BaseMessages with consecutive runs of message types merged into single
 *     messages. If two messages being merged both have string contents, the merged
 *     content is a concatenation of the two strings with a new-line separator. If at
 *     least one of the messages has a list of content blocks, the merged content is a
 *     list of content blocks.
 *
 * @example
 * ```typescript
 * import { mergeMessageRuns, AIMessage, HumanMessage, SystemMessage, ToolCall } from "@langchain/core/messages";
 *
 * const messages = [
 *   new SystemMessage("you're a good assistant."),
 *   new HumanMessage({ content: "what's your favorite color", id: "foo" }),
 *   new HumanMessage({ content: "wait your favorite food", id: "bar" }),
 *   new AIMessage({
 *     content: "my favorite colo",
 *     tool_calls: [{ name: "blah_tool", args: { x: 2 }, id: "123" }],
 *     id: "baz",
 *   }),
 *   new AIMessage({
 *     content: [{ type: "text", text: "my favorite dish is lasagna" }],
 *     tool_calls: [{ name: "blah_tool", args: { x: -10 }, id: "456" }],
 *     id: "blur",
 *   }),
 * ];
 *
 * mergeMessageRuns(messages);
 * ```
 *
 * The above example would return:
 * ```typescript
 * [
 *   new SystemMessage("you're a good assistant."),
 *   new HumanMessage({
 *     content: "what's your favorite colorwait your favorite food",
 *     id: "foo",
 *   }),
 *   new AIMessage({
 *     content: [
 *       { type: "text", text: "my favorite colo" },
 *       { type: "text", text: "my favorite dish is lasagna" },
 *     ],
 *     tool_calls: [
 *       { name: "blah_tool", args: { x: 2 }, id: "123" },
 *       { name: "blah_tool", args: { x: -10 }, id: "456" },
 *     ],
 *     id: "baz",
 *   }),
 * ]
 * ```
 */
export function mergeMessageRuns(messages: BaseMessage[]): BaseMessage[] {
  if (!messages.length) {
    return [];
  }
  const merged: BaseMessage[] = [];
  for (const msg of messages) {
    const curr = msg; // Create a shallow copy of the message
    const last = merged.pop();
    if (!last) {
      merged.push(curr);
    } else if (
      curr._getType() === "tool" ||
      !(curr._getType() === last._getType())
    ) {
      merged.push(last, curr);
    } else {
      const lastChunk = convertToChunk(last) as BaseMessageChunk;
      const currChunk = convertToChunk(curr) as BaseMessageChunk;
      const mergedChunks = lastChunk.concat(currChunk);
      if (
        typeof lastChunk.content === "string" &&
        typeof currChunk.content === "string"
      ) {
        mergedChunks.content = `${lastChunk.content}\n${currChunk.content}`;
      }
      merged.push(chunkToMsg(mergedChunks));
    }
  }
  return merged;
}

/**
 * Since we can not import from `@langchain/textsplitters` we need
 * to reconstruct the interface here.
 */
interface TextSplitterInterface extends BaseDocumentTransformer {
  splitText(text: string): Promise<string[]>;
}

export interface TrimMessagesFields {
  /**
   * @param {number} maxTokens Max token count of trimmed messages.
   */
  maxTokens: number;
  /**
   * @param {((messages: BaseMessage[]) => number) | ((messages: BaseMessage[]) => Promise<number>) | BaseLanguageModel} tokenCounter
   * Function or LLM for counting tokens in an array of `BaseMessage`s.
   * If a `BaseLanguageModel` is passed in then `BaseLanguageModel.getNumTokens()` will be used.
   */
  tokenCounter:
    | ((messages: BaseMessage[]) => number)
    | ((messages: BaseMessage[]) => Promise<number>)
    | BaseLanguageModel;
  /**
   * @param {"first" | "last"} [strategy="last"] Strategy for trimming.
   * - "first": Keep the first <= n_count tokens of the messages.
   * - "last": Keep the last <= n_count tokens of the messages.
   * @default "last"
   */
  strategy?: "first" | "last";
  /**
   * @param {boolean} [allowPartial=false] Whether to split a message if only part of the message can be included.
   * If `strategy: "last"` then the last partial contents of a message are included.
   * If `strategy: "first"` then the first partial contents of a message are included.
   * @default false
   */
  allowPartial?: boolean;
  /**
   * @param {MessageType | BaseMessage | (MessageType | BaseMessage)[]} [endOn] The message type to end on.
   * If specified then every message after the last occurrence of this type is ignored.
   * If `strategy === "last"` then this is done before we attempt to get the last `maxTokens`.
   * If `strategy === "first"` then this is done after we get the first `maxTokens`.
   * Can be specified as string names (e.g. "system", "human", "ai", ...) or as `BaseMessage` classes
   * (e.g. `SystemMessage`, `HumanMessage`, `AIMessage`, ...). Can be a single type or an array of types.
   */
  endOn?: MessageType | BaseMessage | (MessageType | BaseMessage)[];
  /**
   * @param {MessageType | BaseMessage | (MessageType | BaseMessage)[]} [startOn] The message type to start on.
   * Should only be specified if `strategy: "last"`. If specified then every message before the first occurrence
   * of this type is ignored. This is done after we trim the initial messages to the last `maxTokens`.
   * Does not apply to a `SystemMessage` at index 0 if `includeSystem: true`.
   * Can be specified as string names (e.g. "system", "human", "ai", ...) or as `BaseMessage` classes
   * (e.g. `SystemMessage`, `HumanMessage`, `AIMessage`, ...). Can be a single type or an array of types.
   */
  startOn?: MessageType | BaseMessage | (MessageType | BaseMessage)[];
  /**
   * @param {boolean} [includeSystem=false] Whether to keep the `SystemMessage` if there is one at index 0.
   * Should only be specified if `strategy: "last"`.
   * @default false
   */
  includeSystem?: boolean;
  /**
   * @param {((text: string) => string[]) | BaseDocumentTransformer} [textSplitter] Function or `BaseDocumentTransformer` for
   * splitting the string contents of a message. Only used if `allowPartial: true`.
   * If `strategy: "last"` then the last split tokens from a partial message will be included.
   * If `strategy: "first"` then the first split tokens from a partial message will be included.
   * Token splitter assumes that separators are kept, so that split contents can be directly concatenated
   * to recreate the original text. Defaults to splitting on newlines.
   */
  textSplitter?:
    | ((text: string) => string[])
    | ((text: string) => Promise<string[]>)
    | TextSplitterInterface;
}

/**
 * Trim messages to be below a token count.
 *
 * @param {BaseMessage[]} messages Array of `BaseMessage` instances to trim.
 * @param {TrimMessagesFields} options Trimming options.
 * @returns An array of trimmed `BaseMessage`s or a `Runnable` that takes a sequence of `BaseMessage`-like objects and returns
 *     an array of trimmed `BaseMessage`s.
 * @throws {Error} If two incompatible arguments are specified or an unrecognized `strategy` is specified.
 *
 * @example
 * ```typescript
 * import { trimMessages, AIMessage, BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
 *
 * const messages = [
 *   new SystemMessage("This is a 4 token text. The full message is 10 tokens."),
 *   new HumanMessage({
 *     content: "This is a 4 token text. The full message is 10 tokens.",
 *     id: "first",
 *   }),
 *   new AIMessage({
 *     content: [
 *       { type: "text", text: "This is the FIRST 4 token block." },
 *       { type: "text", text: "This is the SECOND 4 token block." },
 *     ],
 *     id: "second",
 *   }),
 *   new HumanMessage({
 *     content: "This is a 4 token text. The full message is 10 tokens.",
 *     id: "third",
 *   }),
 *   new AIMessage({
 *     content: "This is a 4 token text. The full message is 10 tokens.",
 *     id: "fourth",
 *   }),
 * ];
 *
 * function dummyTokenCounter(messages: BaseMessage[]): number {
 *   // treat each message like it adds 3 default tokens at the beginning
 *   // of the message and at the end of the message. 3 + 4 + 3 = 10 tokens
 *   // per message.
 *
 *   const defaultContentLen = 4;
 *   const defaultMsgPrefixLen = 3;
 *   const defaultMsgSuffixLen = 3;
 *
 *   let count = 0;
 *   for (const msg of messages) {
 *     if (typeof msg.content === "string") {
 *       count += defaultMsgPrefixLen + defaultContentLen + defaultMsgSuffixLen;
 *     }
 *     if (Array.isArray(msg.content)) {
 *       count +=
 *         defaultMsgPrefixLen +
 *         msg.content.length * defaultContentLen +
 *         defaultMsgSuffixLen;
 *     }
 *   }
 *   return count;
 * }
 * ```
 *
 * First 30 tokens, not allowing partial messages:
 * ```typescript
 * await trimMessages(messages, {
 *   maxTokens: 30,
 *   tokenCounter: dummyTokenCounter,
 *   strategy: "first",
 * });
 * ```
 *
 * Output:
 * ```typescript
 * [
 *   new SystemMessage(
 *     "This is a 4 token text. The full message is 10 tokens."
 *   ),
 *   new HumanMessage({
 *     content: "This is a 4 token text. The full message is 10 tokens.",
 *     id: "first",
 *   }),
 * ]
 * ```
 *
 * First 30 tokens, allowing partial messages:
 * ```typescript
 * await trimMessages(messages, {
 *   maxTokens: 30,
 *   tokenCounter: dummyTokenCounter,
 *   strategy: "first",
 *   allowPartial: true,
 * });
 * ```
 *
 * Output:
 * ```typescript
 * [
 *   new SystemMessage(
 *     "This is a 4 token text. The full message is 10 tokens."
 *   ),
 *   new HumanMessage({
 *     content: "This is a 4 token text. The full message is 10 tokens.",
 *     id: "first",
 *   }),
 *   new AIMessage({
 *     content: [{ type: "text", text: "This is the FIRST 4 token block." }],
 *     id: "second",
 *   }),
 * ]
 * ```
 *
 * First 30 tokens, allowing partial messages, have to end on HumanMessage:
 * ```typescript
 * await trimMessages(messages, {
 *   maxTokens: 30,
 *   tokenCounter: dummyTokenCounter,
 *   strategy: "first",
 *   allowPartial: true,
 *   endOn: "human",
 * });
 * ```
 *
 * Output:
 * ```typescript
 * [
 *   new SystemMessage(
 *     "This is a 4 token text. The full message is 10 tokens."
 *   ),
 *   new HumanMessage({
 *     content: "This is a 4 token text. The full message is 10 tokens.",
 *     id: "first",
 *   }),
 * ]
 * ```
 *
 * Last 30 tokens, including system message, not allowing partial messages:
 * ```typescript
 * await trimMessages(messages, {
 *   maxTokens: 30,
 *   includeSystem: true,
 *   tokenCounter: dummyTokenCounter,
 *   strategy: "last",
 * });
 * ```
 *
 * Output:
 * ```typescript
 * [
 *   new SystemMessage(
 *     "This is a 4 token text. The full message is 10 tokens."
 *   ),
 *   new HumanMessage({
 *     content: "This is a 4 token text. The full message is 10 tokens.",
 *     id: "third",
 *   }),
 *   new AIMessage({
 *     content: "This is a 4 token text. The full message is 10 tokens.",
 *     id: "fourth",
 *   }),
 * ]
 * ```
 *
 * Last 40 tokens, including system message, allowing partial messages:
 * ```typescript
 * await trimMessages(messages, {
 *   maxTokens: 40,
 *   tokenCounter: dummyTokenCounter,
 *   strategy: "last",
 *   allowPartial: true,
 *   includeSystem: true,
 * });
 * ```
 *
 * Output:
 * ```typescript
 * [
 *   new SystemMessage(
 *     "This is a 4 token text. The full message is 10 tokens."
 *   ),
 *   new AIMessage({
 *     content: [{ type: "text", text: "This is the FIRST 4 token block." }],
 *     id: "second",
 *   }),
 *   new HumanMessage({
 *     content: "This is a 4 token text. The full message is 10 tokens.",
 *     id: "third",
 *   }),
 *   new AIMessage({
 *     content: "This is a 4 token text. The full message is 10 tokens.",
 *     id: "fourth",
 *   }),
 * ]
 * ```
 *
 * Last 30 tokens, including system message, allowing partial messages, end on HumanMessage:
 * ```typescript
 * await trimMessages(messages, {
 *   maxTokens: 30,
 *   tokenCounter: dummyTokenCounter,
 *   strategy: "last",
 *   endOn: "human",
 *   includeSystem: true,
 *   allowPartial: true,
 * });
 * ```
 *
 * Output:
 * ```typescript
 * [
 *   new SystemMessage(
 *     "This is a 4 token text. The full message is 10 tokens."
 *   ),
 *   new AIMessage({
 *     content: [{ type: "text", text: "This is the FIRST 4 token block." }],
 *     id: "second",
 *   }),
 *   new HumanMessage({
 *     content: "This is a 4 token text. The full message is 10 tokens.",
 *     id: "third",
 *   }),
 * ]
 * ```
 *
 * Last 40 tokens, including system message, allowing partial messages, start on HumanMessage:
 * ```typescript
 * await trimMessages(messages, {
 *   maxTokens: 40,
 *   tokenCounter: dummyTokenCounter,
 *   strategy: "last",
 *   includeSystem: true,
 *   allowPartial: true,
 *   startOn: "human",
 * });
 * ```
 *
 * Output:
 * ```typescript
 * [
 *   new SystemMessage(
 *     "This is a 4 token text. The full message is 10 tokens."
 *   ),
 *   new HumanMessage({
 *     content: "This is a 4 token text. The full message is 10 tokens.",
 *     id: "third",
 *   }),
 *   new AIMessage({
 *     content: "This is a 4 token text. The full message is 10 tokens.",
 *     id: "fourth",
 *   }),
 * ]
 * ```
 */
export async function trimMessages(
  messages: BaseMessage[],
  options: TrimMessagesFields
): Promise<BaseMessage[] | Runnable<BaseMessage[], BaseMessage[]>> {
  if (messages.length) {
    return _trimMessagesHelper(messages, options);
  }
  const trimmer = (input: BaseMessage[]) => _trimMessagesHelper(input, options);
  return RunnableLambda.from(trimmer);
}

async function _trimMessagesHelper(
  messages: BaseMessage[],
  options: TrimMessagesFields
): Promise<Array<BaseMessage>> {
  const {
    maxTokens,
    tokenCounter,
    strategy = "last",
    allowPartial = false,
    endOn,
    startOn,
    includeSystem = false,
    textSplitter,
  } = options;
  if (startOn && strategy === "first") {
    throw new Error(
      "`startOn` should only be specified if `strategy` is 'last'."
    );
  }
  if (includeSystem && strategy === "first") {
    throw new Error(
      "`includeSystem` should only be specified if `strategy` is 'last'."
    );
  }

  let listTokenCounter: (msgs: BaseMessage[]) => Promise<number>;
  if ("getNumTokens" in tokenCounter) {
    listTokenCounter = async (msgs: BaseMessage[]): Promise<number> => {
      const tokenCounts = await Promise.all(
        msgs.map((msg) => tokenCounter.getNumTokens(msg.content))
      );
      return tokenCounts.reduce((sum, count) => sum + count, 0);
    };
  } else {
    listTokenCounter = async (msgs: BaseMessage[]): Promise<number> =>
      tokenCounter(msgs);
  }

  let textSplitterFunc: (text: string) => Promise<string[]> =
    defaultTextSplitter;
  if (textSplitter) {
    if ("splitText" in textSplitter) {
      textSplitterFunc = textSplitter.splitText;
    } else {
      textSplitterFunc = async (text: string): Promise<string[]> =>
        textSplitter(text);
    }
  }

  if (strategy === "first") {
    return _firstMaxTokens(messages, {
      maxTokens,
      tokenCounter: listTokenCounter,
      textSplitter: textSplitterFunc,
      partialStrategy: allowPartial ? "first" : undefined,
      endOn,
    });
  } else if (strategy === "last") {
    return _lastMaxTokens(messages, {
      maxTokens,
      tokenCounter: listTokenCounter,
      textSplitter: textSplitterFunc,
      allowPartial,
      includeSystem,
      startOn,
      endOn,
    });
  } else {
    throw new Error(
      `Unrecognized strategy: '${strategy}'. Must be one of 'first' or 'last'.`
    );
  }
}

async function _firstMaxTokens(
  messages: BaseMessage[],
  options: {
    maxTokens: number;
    tokenCounter: (messages: BaseMessage[]) => Promise<number>;
    textSplitter: (text: string) => Promise<string[]>;
    partialStrategy?: "first" | "last";
    endOn?: MessageType | BaseMessage | (MessageType | BaseMessage)[];
  }
): Promise<BaseMessage[]> {
  const { maxTokens, tokenCounter, textSplitter, partialStrategy, endOn } =
    options;
  let messagesCopy = [...messages];
  let idx = 0;
  for (let i = 0; i < messagesCopy.length; i += 1) {
    const remainingMessages = i > 0 ? messagesCopy.slice(0, -i) : messagesCopy;
    if ((await tokenCounter(remainingMessages)) <= maxTokens) {
      idx = messagesCopy.length - i;
      break;
    }
  }
  if (idx < messagesCopy.length - 1 && partialStrategy) {
    let includedPartial = false;
    if (Array.isArray(messagesCopy[idx].content)) {
      const excluded = messagesCopy[idx];
      if (typeof excluded.content === "string") {
        throw new Error("Expected content to be an array.");
      }

      const numBlock = excluded.content.length;
      const reversedContent =
        partialStrategy === "last"
          ? [...excluded.content].reverse()
          : excluded.content;
      for (let i = 1; i <= numBlock; i += 1) {
        const partialContent =
          partialStrategy === "first"
            ? reversedContent.slice(0, i)
            : reversedContent.slice(-i);
        const fields = Object.fromEntries(
          Object.entries(excluded).filter(
            ([k]) => k !== "type" && !k.startsWith("lc_")
          )
        ) as BaseMessageFields;
        const updatedMessage = switchTypeToMessage(excluded._getType(), {
          ...fields,
          content: partialContent,
        });
        const slicedMessages = [...messagesCopy.slice(0, idx), updatedMessage];
        if ((await tokenCounter(slicedMessages)) <= maxTokens) {
          messagesCopy = slicedMessages;
          idx += 1;
          includedPartial = true;
        } else {
          break;
        }
      }
      if (includedPartial && partialStrategy === "last") {
        excluded.content = [...reversedContent].reverse();
      }
    }
    if (!includedPartial) {
      const excluded = messagesCopy[idx];
      let text: string | undefined;
      if (
        Array.isArray(excluded.content) &&
        excluded.content.some(
          (block) => typeof block === "string" || block.type === "text"
        )
      ) {
        const textBlock = excluded.content.find(
          (block) => block.type === "text" && block.text
        ) as { type: "text"; text: string } | undefined;
        text = textBlock?.text;
      } else if (typeof excluded.content === "string") {
        text = excluded.content;
      }
      if (text) {
        const splitTexts = await textSplitter(text);
        const numSplits = splitTexts.length;
        if (partialStrategy === "last") {
          splitTexts.reverse();
        }
        for (let _ = 0; _ < numSplits - 1; _ += 1) {
          splitTexts.pop();
          excluded.content = splitTexts.join("");
          if (
            (await tokenCounter([...messagesCopy.slice(0, idx), excluded])) <=
            maxTokens
          ) {
            if (partialStrategy === "last") {
              excluded.content = [...splitTexts].reverse().join("");
            }
            messagesCopy = [...messagesCopy.slice(0, idx), excluded];
            idx += 1;
            break;
          }
        }
      }
    }
  }

  if (endOn) {
    const endOnArr = Array.isArray(endOn) ? endOn : [endOn];
    while (idx > 0 && !_isMessageType(messagesCopy[idx - 1], endOnArr)) {
      idx -= 1;
    }
  }

  return messagesCopy.slice(0, idx);
}

async function _lastMaxTokens(
  messages: BaseMessage[],
  options: {
    maxTokens: number;
    tokenCounter: (messages: BaseMessage[]) => Promise<number>;
    textSplitter: (text: string) => Promise<string[]>;
    /**
     * @default {false}
     */
    allowPartial?: boolean;
    /**
     * @default {false}
     */
    includeSystem?: boolean;
    startOn?: MessageType | BaseMessage | (MessageType | BaseMessage)[];
    endOn?: MessageType | BaseMessage | (MessageType | BaseMessage)[];
  }
): Promise<BaseMessage[]> {
  const {
    allowPartial = false,
    includeSystem = false,
    endOn,
    startOn,
    ...rest
  } = options;

  if (endOn) {
    const endOnArr = Array.isArray(endOn) ? endOn : [endOn];
    while (
      messages &&
      !_isMessageType(messages[messages.length - 1], endOnArr)
    ) {
      messages.pop();
    }
  }

  const swappedSystem = includeSystem && messages[0]._getType() === "system";
  let reversed_ = swappedSystem
    ? messages.slice(0, 1).concat(messages.slice(1).reverse())
    : messages.reverse();

  reversed_ = await _firstMaxTokens(reversed_, {
    ...rest,
    partialStrategy: allowPartial ? "last" : undefined,
    endOn: startOn,
  });

  if (swappedSystem) {
    return [reversed_[0], ...reversed_.slice(1).reverse()];
  } else {
    return reversed_.reverse();
  }
}

type MessageUnion =
  | typeof HumanMessage
  | typeof AIMessage
  | typeof SystemMessage
  | typeof ChatMessage
  | typeof FunctionMessage
  | typeof ToolMessage;
type MessageChunkUnion =
  | typeof HumanMessageChunk
  | typeof AIMessageChunk
  | typeof SystemMessageChunk
  | typeof FunctionMessageChunk
  | typeof ToolMessageChunk
  | typeof ChatMessageChunk;

const _MSG_CHUNK_MAP: Record<
  MessageType,
  {
    message: MessageUnion;
    messageChunk: MessageChunkUnion;
  }
> = {
  human: {
    message: HumanMessage,
    messageChunk: HumanMessageChunk,
  },
  ai: {
    message: AIMessage,
    messageChunk: AIMessageChunk,
  },
  system: {
    message: SystemMessage,
    messageChunk: SystemMessageChunk,
  },
  tool: {
    message: ToolMessage,
    messageChunk: ToolMessageChunk,
  },
  function: {
    message: FunctionMessage,
    messageChunk: FunctionMessageChunk,
  },
  generic: {
    message: ChatMessage,
    messageChunk: ChatMessageChunk,
  },
};

function switchTypeToMessage(
  messageType: MessageType,
  fields: BaseMessageFields
): BaseMessage;
function switchTypeToMessage(
  messageType: MessageType,
  fields: BaseMessageFields,
  returnChunk: true
): BaseMessageChunk;
function switchTypeToMessage(
  messageType: MessageType,
  fields: BaseMessageFields,
  returnChunk?: boolean
): BaseMessageChunk | BaseMessage {
  let chunk: BaseMessageChunk | undefined;
  let msg: BaseMessage | undefined;

  switch (messageType) {
    case "human":
      if (returnChunk) {
        chunk = new HumanMessageChunk(fields);
      } else {
        msg = new HumanMessage(fields);
      }
      break;
    case "ai":
      if (returnChunk) {
        let aiChunkFields: AIMessageChunkFields = {
          ...fields,
        };
        if ("tool_calls" in aiChunkFields) {
          aiChunkFields = {
            ...aiChunkFields,
            tool_call_chunks: aiChunkFields.tool_calls?.map((tc) => ({
              ...tc,
              index: undefined,
              args: JSON.stringify(tc.args),
            })),
          };
        }
        chunk = new AIMessageChunk(aiChunkFields);
      } else {
        msg = new AIMessage(fields);
      }
      break;
    case "system":
      if (returnChunk) {
        chunk = new SystemMessageChunk(fields);
      } else {
        msg = new SystemMessage(fields);
      }
      break;
    case "tool":
      if ("tool_call_id" in fields) {
        if (returnChunk) {
          chunk = new ToolMessageChunk(
            fields as ToolMessageFieldsWithToolCallId
          );
        } else {
          msg = new ToolMessage(fields as ToolMessageFieldsWithToolCallId);
        }
      } else {
        throw new Error(
          "Can not convert ToolMessage to ToolMessageChunk if 'tool_call_id' field is not defined."
        );
      }
      break;
    case "function":
      if (returnChunk) {
        chunk = new FunctionMessageChunk(fields);
      } else {
        if (!fields.name) {
          throw new Error("FunctionMessage must have a 'name' field");
        }
        msg = new FunctionMessage(fields as FunctionMessageFieldsWithName);
      }
      break;
    case "generic":
      if ("role" in fields) {
        if (returnChunk) {
          chunk = new ChatMessageChunk(fields as ChatMessageFieldsWithRole);
        } else {
          msg = new ChatMessage(fields as ChatMessageFieldsWithRole);
        }
      } else {
        throw new Error(
          "Can not convert ChatMessage to ChatMessageChunk if 'role' field is not defined."
        );
      }
      break;
    default:
      throw new Error(`Unrecognized message type ${messageType}`);
  }

  if (returnChunk && chunk) {
    return chunk;
  }
  if (msg) {
    return msg;
  }
  throw new Error(`Unrecognized message type ${messageType}`);
}

function chunkToMsg(chunk: BaseMessageChunk): BaseMessage {
  const chunkType = chunk._getType();
  let msg: BaseMessage | undefined;
  const fields = Object.fromEntries(
    Object.entries(chunk).filter(
      ([k]) => !["type", "tool_call_chunks"].includes(k) && !k.startsWith("lc_")
    )
  ) as BaseMessageFields;

  if (chunkType in _MSG_CHUNK_MAP) {
    msg = switchTypeToMessage(chunkType, fields);
  }

  if (!msg) {
    throw new Error(
      `Unrecognized message chunk class ${chunkType}. Supported classes are ${Object.keys(
        _MSG_CHUNK_MAP
      )}`
    );
  }

  return msg;
}

function defaultTextSplitter(text: string): Promise<string[]> {
  const splits = text.split("\n");
  return Promise.resolve([
    ...splits.slice(0, -1).map((s) => `${s}\n`),
    splits[splits.length - 1],
  ]);
}
