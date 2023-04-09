import { LLMChain } from "./llm_chain.js";
import { BasePromptTemplate, PromptTemplate } from "../prompts/index.js";

import { BaseMemory, BufferMemory } from "../memory/index.js";
import { BaseLanguageModel } from "../base_language/index.js";

const defaultTemplate = `The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.

Current conversation:
{history}
Human: {input}
AI:`;

// TODO: Dedupe this from implementation in ./llm_chain.ts
export class ConversationChain<O extends string> extends LLMChain<
  "input",
  O | "response",
  "history"
> {
  constructor(fields: {
    llm: BaseLanguageModel;
    prompt?: BasePromptTemplate<"input", "history">;
    outputKey?: O;
    memory?: BaseMemory<"input", O, "history">;
  }) {
    super({
      prompt:
        fields.prompt ??
        new PromptTemplate<"input", "history">({
          template: defaultTemplate,
          inputVariables: ["input"],
        }),
      llm: fields.llm,
      outputKey: fields.outputKey ?? "response",
    });
    this.memory = fields.memory ?? new BufferMemory<"input", O>();
  }
}
