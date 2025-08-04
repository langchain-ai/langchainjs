import { LanguageModelLike } from "@langchain/core/language_models/base";
import {
  AIMessage,
  BaseMessage,
  BaseMessageLike,
  isAIMessage,
  isAIMessageChunk,
  isBaseMessage,
  isBaseMessageChunk,
  MessageContent,
} from "@langchain/core/messages";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { Send } from "@langchain/langgraph";

export function isSend(x: unknown): x is Send {
  // eslint-disable-next-line no-instanceof/no-instanceof
  return x instanceof Send;
}

const NAME_PATTERN = /<name>(.*?)<\/name>/s;
const CONTENT_PATTERN = /<content>(.*?)<\/content>/s;

export type AgentNameMode = "inline";

/**
 * Attach formatted agent names to the messages passed to and from a language model.
 *
 * This is useful for making a message history with multiple agents more coherent.
 *
 * NOTE: agent name is consumed from the message.name field.
 * If you're using an agent built with createReactAgent, name is automatically set.
 * If you're building a custom agent, make sure to set the name on the AI message returned by the LLM.
 *
 * @param message - Message to add agent name formatting to
 * @returns Message with agent name formatting
 *
 * @internal
 */
export function _addInlineAgentName<T extends BaseMessageLike>(
  message: T
): T | AIMessage {
  const isAI =
    isBaseMessage(message) &&
    (isAIMessage(message) ||
      (isBaseMessageChunk(message) && isAIMessageChunk(message)));

  if (!isAI || !message.name) {
    return message;
  }

  const { name } = message;

  if (typeof message.content === "string") {
    return new AIMessage({
      ...(Object.keys(message.lc_kwargs ?? {}).length > 0
        ? message.lc_kwargs
        : message),
      content: `<name>${name}</name><content>${message.content}</content>`,
      name: undefined,
    });
  }

  const updatedContent = [];
  let textBlockCount = 0;

  for (const contentBlock of message.content) {
    if (typeof contentBlock === "string") {
      textBlockCount += 1;
      updatedContent.push(
        `<name>${name}</name><content>${contentBlock}</content>`
      );
    } else if (
      typeof contentBlock === "object" &&
      "type" in contentBlock &&
      contentBlock.type === "text"
    ) {
      textBlockCount += 1;
      updatedContent.push({
        ...contentBlock,
        text: `<name>${name}</name><content>${contentBlock.text}</content>`,
      });
    } else {
      updatedContent.push(contentBlock);
    }
  }

  if (!textBlockCount) {
    updatedContent.unshift({
      type: "text",
      text: `<name>${name}</name><content></content>`,
    });
  }
  return new AIMessage({
    ...message.lc_kwargs,
    content: updatedContent as MessageContent,
    name: undefined,
  });
}

/**
 * Remove explicit name and content XML tags from the AI message content.
 *
 * Examples:
 *
 * @example
 * ```typescript
 * removeInlineAgentName(new AIMessage({ content: "<name>assistant</name><content>Hello</content>", name: "assistant" }))
 * // AIMessage with content: "Hello"
 *
 * removeInlineAgentName(new AIMessage({ content: [{type: "text", text: "<name>assistant</name><content>Hello</content>"}], name: "assistant" }))
 * // AIMessage with content: [{type: "text", text: "Hello"}]
 * ```
 *
 * @internal
 */
export function _removeInlineAgentName<T extends BaseMessage>(message: T): T {
  if (!isAIMessage(message) || !message.content) {
    return message;
  }

  let updatedContent: MessageContent = [];
  let updatedName: string | undefined;

  if (Array.isArray(message.content)) {
    updatedContent = message.content
      .filter((block) => {
        if (block.type === "text") {
          const nameMatch = block.text.match(NAME_PATTERN);
          const contentMatch = block.text.match(CONTENT_PATTERN);
          // don't include empty content blocks that were added because there was no text block to modify
          if (nameMatch && (!contentMatch || contentMatch[1] === "")) {
            // capture name from text block
            // eslint-disable-next-line prefer-destructuring
            updatedName = nameMatch[1];
            return false;
          }
          return true;
        }
        return true;
      })
      .map((block) => {
        if (block.type === "text") {
          const nameMatch = block.text.match(NAME_PATTERN);
          const contentMatch = block.text.match(CONTENT_PATTERN);

          if (!nameMatch || !contentMatch) {
            return block;
          }

          // capture name from text block
          // eslint-disable-next-line prefer-destructuring
          updatedName = nameMatch[1];

          return {
            ...block,
            text: contentMatch[1],
          };
        }
        return block;
      });
  } else {
    const content = message.content as string;
    const nameMatch = content.match(NAME_PATTERN);
    const contentMatch = content.match(CONTENT_PATTERN);

    if (!nameMatch || !contentMatch) {
      return message;
    }

    // eslint-disable-next-line prefer-destructuring
    updatedName = nameMatch[1];
    // eslint-disable-next-line prefer-destructuring
    updatedContent = contentMatch[1];
  }

  return new AIMessage({
    ...(Object.keys(message.lc_kwargs ?? {}).length > 0
      ? message.lc_kwargs
      : message),
    content: updatedContent,
    name: updatedName,
  }) as T;
}

/**
 * Attach formatted agent names to the messages passed to and from a language model.
 *
 * This is useful for making a message history with multiple agents more coherent.
 *
 * NOTE: agent name is consumed from the message.name field.
 * If you're using an agent built with createReactAgent, name is automatically set.
 * If you're building a custom agent, make sure to set the name on the AI message returned by the LLM.
 *
 * @param model - Language model to add agent name formatting to
 * @param agentNameMode - How to expose the agent name to the LLM
 *   - "inline": Add the agent name directly into the content field of the AI message using XML-style tags.
 *     Example: "How can I help you" -> "<name>agent_name</name><content>How can I help you?</content>".
 */
export function withAgentName(
  model: LanguageModelLike,
  agentNameMode: AgentNameMode
): LanguageModelLike {
  let processInputMessage: (message: BaseMessageLike) => BaseMessageLike;
  let processOutputMessage: (message: BaseMessage) => BaseMessage;

  if (agentNameMode === "inline") {
    processInputMessage = _addInlineAgentName;
    processOutputMessage = _removeInlineAgentName;
  } else {
    throw new Error(
      `Invalid agent name mode: ${agentNameMode}. Needs to be one of: "inline"`
    );
  }

  function processInputMessages(
    messages: BaseMessageLike[]
  ): BaseMessageLike[] {
    return messages.map(processInputMessage);
  }

  return RunnableSequence.from([
    RunnableLambda.from(processInputMessages),
    model,
    RunnableLambda.from(processOutputMessage),
  ]);
}
