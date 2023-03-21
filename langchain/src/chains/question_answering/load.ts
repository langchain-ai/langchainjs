import { LLMChain } from "../llm_chain.js";
import { PromptTemplate, BasePromptTemplate } from "../../prompts/index.js";
import {
  StuffDocumentsChain,
  MapReduceDocumentsChain,
} from "../combine_docs_chain.js";
import { QA_PROMPT_SELECTOR, DEFAULT_QA_PROMPT } from "./stuff_prompts.js";
import {
  COMBINE_PROMPT,
  DEFAULT_COMBINE_QA_PROMPT,
  COMBINE_PROMPT_SELECTOR,
  COMBINE_QA_PROMPT_SELECTOR,
} from "./map_reduce_prompts.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import { KeyValueOutputParser } from "../../output_parsers/index.js";
import { QA_PROMPT_SELECTOR_WITH_SOURCES } from "./stuff_prompts_with_sources.js";

interface qaChainParams {
  prompt?: BasePromptTemplate;
  combineMapPrompt?: BasePromptTemplate;
  combinePrompt?: BasePromptTemplate;
  type?: string;
}
export const loadQAChain = (
  llm: BaseLanguageModel,
  params: qaChainParams = {}
) => {
  const {
    prompt = DEFAULT_QA_PROMPT,
    combineMapPrompt = DEFAULT_COMBINE_QA_PROMPT,
    combinePrompt = COMBINE_PROMPT,
    type = "stuff",
  } = params;
  if (type === "stuff") {
    const llmChain = new LLMChain({ prompt, llm });
    const chain = new StuffDocumentsChain({ llmChain });
    return chain;
  }
  if (type === "map_reduce") {
    const llmChain = new LLMChain({ prompt: combineMapPrompt, llm });
    const combineLLMChain = new LLMChain({ prompt: combinePrompt, llm });
    const combineDocumentChain = new StuffDocumentsChain({
      llmChain: combineLLMChain,
      documentVariableName: "summaries",
    });
    const chain = new MapReduceDocumentsChain({
      llmChain,
      combineDocumentChain,
    });
    return chain;
  }
  throw new Error(`Invalid _type: ${type}`);
};

interface StuffQAChainParams {
  prompt?: BasePromptTemplate;
  withSources?: boolean;
}

export const loadQAStuffChain = (
  llm: BaseLanguageModel,
  params: StuffQAChainParams = {}
) => {
  const outputParser = new KeyValueOutputParser(["FINAL ANSWER", "SOURCES"]);
  const {
    prompt = params.withSources
      ? QA_PROMPT_SELECTOR_WITH_SOURCES.getPrompt(llm)
      : QA_PROMPT_SELECTOR.getPrompt(llm),
  } = params;
  const llmChain = new LLMChain({ prompt, llm });
  const chain = new StuffDocumentsChain(
    params.withSources
      ? {
          llmChain,
          outputParser: new KeyValueOutputParser(["FINAL ANSWER", "SOURCES"]),
          documentPrompt: PromptTemplate.fromTemplate(
            `Content: {page_content}\nSource: {source}`
          ),
        }
      : { llmChain }
  );
  return chain;
};

interface MapReduceQAChainParams {
  combineMapPrompt?: BasePromptTemplate;
  combinePrompt?: BasePromptTemplate;
}

export const loadQAMapReduceChain = (
  llm: BaseLanguageModel,
  params: MapReduceQAChainParams = {}
) => {
  const {
    combineMapPrompt = COMBINE_QA_PROMPT_SELECTOR.getPrompt(llm),
    combinePrompt = COMBINE_PROMPT_SELECTOR.getPrompt(llm),
  } = params;
  const llmChain = new LLMChain({ prompt: combineMapPrompt, llm });
  const combineLLMChain = new LLMChain({ prompt: combinePrompt, llm });
  const combineDocumentChain = new StuffDocumentsChain({
    llmChain: combineLLMChain,
    documentVariableName: "summaries",
  });
  const chain = new MapReduceDocumentsChain({
    llmChain,
    combineDocumentChain,
  });
  return chain;
};
