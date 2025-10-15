import type { BaseLanguageModelInterface } from "@langchain/core/language_models/base";
import { BasePromptTemplate } from "@langchain/core/prompts";
import { LLMChain } from "../llm_chain.js";
import {
  StuffDocumentsChain,
  MapReduceDocumentsChain,
  RefineDocumentsChain,
  MapReduceDocumentsChainInput,
} from "../combine_docs_chain.js";
import { DEFAULT_PROMPT } from "./stuff_prompts.js";
import { REFINE_PROMPT } from "./refine_prompts.js";

/**
 * Type for the base parameters that can be used to configure a
 * summarization chain.
 */
type BaseParams = {
  verbose?: boolean;
};

/** @interface */
export type SummarizationChainParams = BaseParams &
  (
    | {
        type?: "stuff";
        prompt?: BasePromptTemplate;
      }
    | ({
        type?: "map_reduce";
        combineMapPrompt?: BasePromptTemplate;
        combinePrompt?: BasePromptTemplate;
        combineLLM?: BaseLanguageModelInterface;
      } & Pick<MapReduceDocumentsChainInput, "returnIntermediateSteps">)
    | {
        type?: "refine";
        refinePrompt?: BasePromptTemplate;
        refineLLM?: BaseLanguageModelInterface;
        questionPrompt?: BasePromptTemplate;
      }
  );

export const loadSummarizationChain = (
  llm: BaseLanguageModelInterface,
  params: SummarizationChainParams = { type: "map_reduce" }
) => {
  const { verbose } = params;
  if (params.type === "stuff") {
    const { prompt = DEFAULT_PROMPT } = params;
    const llmChain = new LLMChain({ prompt, llm, verbose });
    const chain = new StuffDocumentsChain({
      llmChain,
      documentVariableName: "text",
      verbose,
    });
    return chain;
  }
  if (params.type === "map_reduce") {
    const {
      combineMapPrompt = DEFAULT_PROMPT,
      combinePrompt = DEFAULT_PROMPT,
      combineLLM,
      returnIntermediateSteps,
    } = params;
    const llmChain = new LLMChain({ prompt: combineMapPrompt, llm, verbose });
    const combineLLMChain = new LLMChain({
      prompt: combinePrompt,
      llm: combineLLM ?? llm,
      verbose,
    });
    const combineDocumentChain = new StuffDocumentsChain({
      llmChain: combineLLMChain,
      documentVariableName: "text",
      verbose,
    });
    const chain = new MapReduceDocumentsChain({
      llmChain,
      combineDocumentChain,
      documentVariableName: "text",
      returnIntermediateSteps,
      verbose,
    });
    return chain;
  }
  if (params.type === "refine") {
    const {
      refinePrompt = REFINE_PROMPT,
      refineLLM,
      questionPrompt = DEFAULT_PROMPT,
    } = params;
    const llmChain = new LLMChain({ prompt: questionPrompt, llm, verbose });
    const refineLLMChain = new LLMChain({
      prompt: refinePrompt,
      llm: refineLLM ?? llm,
      verbose,
    });
    const chain = new RefineDocumentsChain({
      llmChain,
      refineLLMChain,
      documentVariableName: "text",
      verbose,
    });
    return chain;
  }
  throw new Error(`Invalid _type: ${params.type}`);
};
