import { BaseLanguageModel } from "../../base_language/index.js";
import { LLMChain } from "../llm_chain.js";
import { BasePromptTemplate } from "../../prompts/base.js";
import {
  StuffDocumentsChain,
  MapReduceDocumentsChain,
  RefineDocumentsChain,
  MapReduceDocumentsChainInput,
} from "../combine_docs_chain.js";
import { DEFAULT_PROMPT } from "./stuff_prompts.js";
import { REFINE_PROMPT } from "./refine_prompts.js";

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
      } & Pick<MapReduceDocumentsChainInput, "returnIntermediateSteps">)
    | {
        type?: "refine";
        refinePrompt?: BasePromptTemplate;
        questionPrompt?: BasePromptTemplate;
      }
  );

export const loadSummarizationChain = (
  llm: BaseLanguageModel,
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
      returnIntermediateSteps,
    } = params;
    const llmChain = new LLMChain({ prompt: combineMapPrompt, llm, verbose });
    const combineLLMChain = new LLMChain({
      prompt: combinePrompt,
      llm,
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
    const { refinePrompt = REFINE_PROMPT, questionPrompt = DEFAULT_PROMPT } =
      params;
    const llmChain = new LLMChain({ prompt: questionPrompt, llm, verbose });
    const refineLLMChain = new LLMChain({ prompt: refinePrompt, llm, verbose });
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
