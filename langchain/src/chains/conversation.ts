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
export class ConversationChain<
  I extends string = string,
  O extends string = string,
  MI extends string = string
> extends LLMChain<I, O, MI> {
  constructor(fields: {
    llm: BaseLanguageModel;
    prompt?: BasePromptTemplate<I, MI>;
    outputKey?: O;
    memory?: BaseMemory<I, O, MI>;
  }) {
    super({
      prompt:
        fields.prompt ??
        new PromptTemplate<I, MI>({
          template: defaultTemplate,
          inputVariables: ["input" as I],
        }),
      llm: fields.llm,
      outputKey: fields.outputKey ?? ("response" as O),
    });
    this.memory = fields.memory ?? new BufferMemory<I, O, MI>();
  }
}

