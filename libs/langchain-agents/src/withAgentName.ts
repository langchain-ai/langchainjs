import { BaseMessage, BaseMessageLike } from "@langchain/core/messages";
import { LanguageModelLike } from "@langchain/core/language_models/base";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";

import {
  AgentNameMode,
  _addInlineAgentName,
  _removeInlineAgentName,
} from "./utils.js";

/**
 * Attach formatted agent names to the messages passed to and from a language model.
 *
 * This is useful for making a message history with multiple agents more coherent.
 *
 * NOTE: agent name is consumed from the message.name field.
 * If you're using an agent built with createAgent, name is automatically set.
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
