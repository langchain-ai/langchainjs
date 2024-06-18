import {
  BaseMessageLike,
  BaseMessage,
  isBaseMessage,
  StoredMessage,
  StoredMessageV1,
  MessageType,
  BaseMessageChunk,
  BaseMessageFields,
} from "./base.js";
import { HumanMessage, HumanMessageChunk } from "./human.js";
import { AIMessage, AIMessageChunk, AIMessageChunkFields } from "./ai.js";
import { SystemMessage, SystemMessageChunk } from "./system.js";
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
import {
  ToolMessage,
  ToolMessageChunk,
  ToolMessageFieldsWithToolCallId,
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
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new AIMessageChunk({ ...message });
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
      const lastChunk = msgToChunk(last);
      const currChunk = msgToChunk(curr);
      const mergedChunks = lastChunk.concat(currChunk);
      if (typeof lastChunk.content === "string" && typeof currChunk.content === "string") {
        mergedChunks.content = `${lastChunk.content}\n${currChunk.content}`;
      }
      merged.push(chunkToMsg(mergedChunks));
    }
  }
  return merged;
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

function msgToChunk(message: BaseMessage): BaseMessageChunk {
  const msgType = message._getType();
  let chunk: BaseMessageChunk | undefined;
  const fields = Object.fromEntries(
    Object.entries(message).filter(
      ([k]) => k !== "type" && !k.startsWith("lc_")
    )
  ) as BaseMessageFields;

  if (msgType in _MSG_CHUNK_MAP) {
    chunk = switchTypeToMessage(msgType, fields, true);
  }

  if (!chunk) {
    throw new Error(
      `Unrecognized message class ${msgType}. Supported classes are ${Object.keys(
        _MSG_CHUNK_MAP
      )}`
    );
  }

  return chunk;
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

// const defaultTextSplitter = (text: string): string[] => {
//   const splits = text.split("\n");
//   return [...splits.slice(0, -1).map((s) => s + "\n"), splits[splits.length - 1]];
// };
