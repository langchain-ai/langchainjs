import { BaseDocumentTransformer } from "../documents/transformers.js";
import { BaseLanguageModel } from "../language_models/base.js";
import { Runnable, RunnableLambda } from "../runnables/base.js";
import { AIMessage, AIMessageChunk, AIMessageChunkFields } from "./ai.js";
import {
  BaseMessage,
  MessageType,
  BaseMessageChunk,
  BaseMessageFields,
} from "./base.js";
import {
  ChatMessage,
  ChatMessageChunk,
  ChatMessageFieldsWithRole,
} from "./chat.js";
import {
  FunctionMessage,
  FunctionMessageChunk,
  FunctionMessageFieldsWithName,
} from "./function.js";
import { HumanMessage, HumanMessageChunk } from "./human.js";
import { RemoveMessage } from "./modifier.js";
import { SystemMessage, SystemMessageChunk } from "./system.js";
import {
  ToolMessage,
  ToolMessageChunk,
  ToolMessageFieldsWithToolCallId,
} from "./tool.js";
import { convertToChunk } from "./utils.js";

export type MessageUnion =
  | typeof HumanMessage
  | typeof AIMessage
  | typeof SystemMessage
  | typeof ChatMessage
  | typeof FunctionMessage
  | typeof ToolMessage
  | typeof RemoveMessage;
export type MessageChunkUnion =
  | typeof HumanMessageChunk
  | typeof AIMessageChunk
  | typeof SystemMessageChunk
  | typeof FunctionMessageChunk
  | typeof ToolMessageChunk
  | typeof ChatMessageChunk
  | typeof RemoveMessage; // RemoveMessage does not have a chunk class.
export type MessageTypeOrClass = MessageType | MessageUnion | MessageChunkUnion;

const _isMessageType = (msg: BaseMessage, types: MessageTypeOrClass[]) => {
  const typesAsStrings = [
    ...new Set<string>(
      types?.map((t) => {
        if (typeof t === "string") {
          return t;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const instantiatedMsgClass = new (t as any)({});
        if (
          !("_getType" in instantiatedMsgClass) ||
          typeof instantiatedMsgClass._getType !== "function"
        ) {
          throw new Error("Invalid type provided.");
        }
        return instantiatedMsgClass._getType();
      })
    ),
  ];
  const msgType = msg._getType();
  return typesAsStrings.some((t) => t === msgType);
};

export interface FilterMessagesFields {
  /**
   * @param {string[] | undefined} includeNames Message names to include.
   */
  includeNames?: string[];
  /**
   * @param {string[] | undefined} excludeNames Messages names to exclude.
   */
  excludeNames?: string[];
  /**
   * @param {(MessageType | BaseMessage)[] | undefined} includeTypes Message types to include. Can be specified as string names (e.g.
   *     "system", "human", "ai", ...) or as BaseMessage classes (e.g.
   *     SystemMessage, HumanMessage, AIMessage, ...).
   */
  includeTypes?: MessageTypeOrClass[];
  /**
   * @param {(MessageType | BaseMessage)[] | undefined} excludeTypes Message types to exclude. Can be specified as string names (e.g.
   *     "system", "human", "ai", ...) or as BaseMessage classes (e.g.
   *     SystemMessage, HumanMessage, AIMessage, ...).
   */
  excludeTypes?: MessageTypeOrClass[];
  /**
   * @param {string[] | undefined} includeIds Message IDs to include.
   */
  includeIds?: string[];
  /**
   * @param {string[] | undefined} excludeIds Message IDs to exclude.
   */
  excludeIds?: string[];
}

/**
 * Filter messages based on name, type or id.
 *
 * @param {BaseMessage[] | FilterMessagesFields} messagesOrOptions - Either an array of BaseMessage objects to filter or the filtering options. If an array is provided, the `options` parameter should also be supplied. If filtering options are provided, a RunnableLambda is returned.
 * @param {FilterMessagesFields} [options] - Optional filtering options. Should only be provided if `messagesOrOptions` is an array of BaseMessage objects.
 * @returns A list of Messages that meets at least one of the include conditions and none
 *     of the exclude conditions, or a RunnableLambda which does the same. If no include conditions are specified then
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
  options?: FilterMessagesFields
): Runnable<BaseMessage[], BaseMessage[]>;
export function filterMessages(
  messages: BaseMessage[],
  options?: FilterMessagesFields
): BaseMessage[];
export function filterMessages(
  messagesOrOptions?: BaseMessage[] | FilterMessagesFields,
  options?: FilterMessagesFields
): BaseMessage[] | Runnable<BaseMessage[], BaseMessage[]> {
  if (Array.isArray(messagesOrOptions)) {
    return _filterMessages(messagesOrOptions, options);
  }
  return RunnableLambda.from((input: BaseMessage[]): BaseMessage[] => {
    return _filterMessages(input, messagesOrOptions);
  });
}

function _filterMessages(
  messages: BaseMessage[],
  options: FilterMessagesFields = {}
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
 * @param {BaseMessage[] | undefined} messages Sequence of Message-like objects to merge. Optional. If not provided, a RunnableLambda is returned.
 * @returns List of BaseMessages with consecutive runs of message types merged into single
 *     messages, or a RunnableLambda which returns a list of BaseMessages If two messages being merged both have string contents, the merged
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
export function mergeMessageRuns(): Runnable<BaseMessage[], BaseMessage[]>;
export function mergeMessageRuns(messages: BaseMessage[]): BaseMessage[];
export function mergeMessageRuns(
  messages?: BaseMessage[]
): BaseMessage[] | Runnable<BaseMessage[], BaseMessage[]> {
  if (Array.isArray(messages)) {
    return _mergeMessageRuns(messages);
  }
  return RunnableLambda.from(_mergeMessageRuns);
}

function _mergeMessageRuns(messages: BaseMessage[]): BaseMessage[] {
  if (!messages.length) {
    return [];
  }
  const merged: BaseMessage[] = [];
  for (const msg of messages) {
    const curr = msg;
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
      merged.push(_chunkToMsg(mergedChunks));
    }
  }
  return merged;
}

// Since we can not import from `@langchain/textsplitters` we need
// to reconstruct the interface here.
interface _TextSplitterInterface extends BaseDocumentTransformer {
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
   * @param {MessageTypeOrClass | MessageTypeOrClass[]} [endOn] The message type to end on.
   * If specified then every message after the last occurrence of this type is ignored.
   * If `strategy === "last"` then this is done before we attempt to get the last `maxTokens`.
   * If `strategy === "first"` then this is done after we get the first `maxTokens`.
   * Can be specified as string names (e.g. "system", "human", "ai", ...) or as `BaseMessage` classes
   * (e.g. `SystemMessage`, `HumanMessage`, `AIMessage`, ...). Can be a single type or an array of types.
   */
  endOn?: MessageTypeOrClass | MessageTypeOrClass[];
  /**
   * @param {MessageTypeOrClass | MessageTypeOrClass[]} [startOn] The message type to start on.
   * Should only be specified if `strategy: "last"`. If specified then every message before the first occurrence
   * of this type is ignored. This is done after we trim the initial messages to the last `maxTokens`.
   * Does not apply to a `SystemMessage` at index 0 if `includeSystem: true`.
   * Can be specified as string names (e.g. "system", "human", "ai", ...) or as `BaseMessage` classes
   * (e.g. `SystemMessage`, `HumanMessage`, `AIMessage`, ...). Can be a single type or an array of types.
   */
  startOn?: MessageTypeOrClass | MessageTypeOrClass[];
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
    | _TextSplitterInterface;
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
export function trimMessages(
  options: TrimMessagesFields
): Runnable<BaseMessage[], BaseMessage[]>;
export function trimMessages(
  messages: BaseMessage[],
  options: TrimMessagesFields
): Promise<BaseMessage[]>;
export function trimMessages(
  messagesOrOptions: BaseMessage[] | TrimMessagesFields,
  options?: TrimMessagesFields
): Promise<BaseMessage[]> | Runnable<BaseMessage[], BaseMessage[]> {
  if (Array.isArray(messagesOrOptions)) {
    const messages = messagesOrOptions;
    if (!options) {
      throw new Error("Options parameter is required when providing messages.");
    }
    return _trimMessagesHelper(messages, options);
  } else {
    const trimmerOptions = messagesOrOptions;
    return RunnableLambda.from((input: BaseMessage[]) =>
      _trimMessagesHelper(input, trimmerOptions)
    ).withConfig({
      runName: "trim_messages",
    });
  }
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
    endOn?: MessageTypeOrClass | MessageTypeOrClass[];
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
        const updatedMessage = _switchTypeToMessage(excluded._getType(), {
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
    startOn?: MessageTypeOrClass | MessageTypeOrClass[];
    endOn?: MessageTypeOrClass | MessageTypeOrClass[];
  }
): Promise<BaseMessage[]> {
  const {
    allowPartial = false,
    includeSystem = false,
    endOn,
    startOn,
    ...rest
  } = options;

  // Create a copy of messages to avoid mutation
  let messagesCopy = [...messages];

  if (endOn) {
    const endOnArr = Array.isArray(endOn) ? endOn : [endOn];
    while (
      messagesCopy.length > 0 &&
      !_isMessageType(messagesCopy[messagesCopy.length - 1], endOnArr)
    ) {
      messagesCopy = messagesCopy.slice(0, -1);
    }
  }

  const swappedSystem =
    includeSystem && messagesCopy[0]?._getType() === "system";
  let reversed_ = swappedSystem
    ? messagesCopy.slice(0, 1).concat(messagesCopy.slice(1).reverse())
    : messagesCopy.reverse();

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
  developer: {
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
  remove: {
    message: RemoveMessage,
    messageChunk: RemoveMessage, // RemoveMessage does not have a chunk class.
  },
};

function _switchTypeToMessage(
  messageType: MessageType,
  fields: BaseMessageFields
): BaseMessage;
function _switchTypeToMessage(
  messageType: MessageType,
  fields: BaseMessageFields,
  returnChunk: true
): BaseMessageChunk;
function _switchTypeToMessage(
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
              type: "tool_call_chunk",
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
    case "developer":
      if (returnChunk) {
        chunk = new SystemMessageChunk({
          ...fields,
          additional_kwargs: {
            ...fields.additional_kwargs,
            __openai_role__: "developer",
          },
        });
      } else {
        msg = new SystemMessage({
          ...fields,
          additional_kwargs: {
            ...fields.additional_kwargs,
            __openai_role__: "developer",
          },
        });
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

function _chunkToMsg(chunk: BaseMessageChunk): BaseMessage {
  const chunkType = chunk._getType();
  let msg: BaseMessage | undefined;
  const fields = Object.fromEntries(
    Object.entries(chunk).filter(
      ([k]) => !["type", "tool_call_chunks"].includes(k) && !k.startsWith("lc_")
    )
  ) as BaseMessageFields;

  if (chunkType in _MSG_CHUNK_MAP) {
    msg = _switchTypeToMessage(chunkType, fields);
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

/**
 * The default text splitter function that splits text by newlines.
 *
 * @param {string} text
 * @returns A promise that resolves to an array of strings split by newlines.
 */
export function defaultTextSplitter(text: string): Promise<string[]> {
  const splits = text.split("\n");
  return Promise.resolve([
    ...splits.slice(0, -1).map((s) => `${s}\n`),
    splits[splits.length - 1],
  ]);
}
