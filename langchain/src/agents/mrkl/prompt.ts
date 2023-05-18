import { AI_PROMPT } from "@anthropic-ai/sdk";
import { BaseLanguageModel } from "../../base_language/index.js";

export const PREFIX = `Answer the following questions as best you can. You have access to the following tools:`;
export const FORMAT_INSTRUCTIONS = `Use the following format in your response:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question`;
export const getSuffixForLLM = (llm?: BaseLanguageModel) => {
  switch (llm?._llmType()) {
    case "anthropic":
      return `Begin!

Question: {input}
${AI_PROMPT} Thought: {agent_scratchpad}`;
    default:
      return `Begin!

Question: {input}
Thought:{agent_scratchpad}`;
  }
};
