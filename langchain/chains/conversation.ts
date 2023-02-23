import { LLMChain } from "./llm_chain.js";
import { BaseLLM } from "../llms/index.js";
import { BasePromptTemplate, PromptTemplate } from "../prompts/index.js";

import { BaseMemory, BufferMemory } from "../memory/index.js";

const defaultTemplate = `The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.

Current conversation:
{history}
Human: {input}
AI:`;

const defaultPrompt = new PromptTemplate({
  template: defaultTemplate,
  inputVariables: ["history", "input"],
});

export class ConversationChain extends LLMChain {
  constructor(fields: {
    llm: BaseLLM;
    prompt?: BasePromptTemplate;
    outputKey?: string;
    memory?: BaseMemory;
  }) {
    super({
      prompt: fields.prompt ?? defaultPrompt,
      llm: fields.llm,
      outputKey: fields.outputKey ?? "response",
    });
    this.memory = fields.memory ?? new BufferMemory();
  }
}
