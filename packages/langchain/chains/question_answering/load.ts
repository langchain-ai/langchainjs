import { BaseLLM } from "../../llms";
import { LLMChain } from "../llm_chain";
import { StuffDocumentsChain } from "../combine_docs_chain";
import { DEFAULT_QA_PROMPT } from "./stuff_prompts";

export const loadQAChain = (llm: BaseLLM, prompt = DEFAULT_QA_PROMPT) => {
  const llmChain = new LLMChain({ prompt, llm });
  const chain = new StuffDocumentsChain({ llmChain });
  return chain;
};
