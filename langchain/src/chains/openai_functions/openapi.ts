import { OpenAPISpec } from "../../util/openapi.js";
import { ChainValues } from "../../schema/index.js";
import { CallbackManagerForChainRun } from "../../callbacks/manager.js";
import { BaseChain } from "../base.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { BasePromptTemplate, LLMChain } from "../../index.js";
import { ChatPromptTemplate, HumanMessagePromptTemplate } from "../../prompts/chat.js";
import { SequentialChain } from "../sequential_chain.js";

function getDescription (spec: Record<string, any>, preferShort: boolean) {
  return preferShort ? (spec.summary ?? spec.description) : (spec.description ?? spec.summary);
}

function formatURL (url: string, pathParams: Record<string, string>): string {
  // const expectedPathParams;
}

function convertOpenAPISpecToOpenAIFunction(spec: OpenAPISpec) {
  if (!spec.document.paths) {
    return [[], () => undefined];
  }
  for (const path of Object.keys(spec.paths)) {
    const pathParams = spec.getParametersForPath(path);
  }
}

class SimpleRequestChain extends BaseChain {
  inputKey = "function";

  outputKey = "response";

  constructor() {
    super();
  }

  get inputKeys() {
    return [this.inputKey];
  }

  get outputKeys() {
    return [this.outputKey];
  }

  _chainType() {
    return "simple_request_chain" as const;
  }

  /** @ignore */
  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun
  ): Promise<ChainValues> {



    return { [this.outputKey]: response };
  }

}

export type OpenAPIChainOptions = {
  llm?: ChatOpenAI,
  prompt?: BasePromptTemplate,
  requestChain?: BaseChain,
  verbose?: boolean
}

/**
 * Create a chain for querying an API from a OpenAPI spec.
 * @param spec OpenAPISpec or url/file/text string corresponding to one.
 * @param options Custom options passed into the chain
 * @returns OpenAPIChain
 */
export function createOpenAPIChain (
  spec: object,
  options: OpenAPIChainOptions = {}
) {
  const {
    llm = new ChatOpenAI({ modelName: "gpt-3.5-turbo-0613" }),
    prompt = ChatPromptTemplate.fromPromptMessages([
      HumanMessagePromptTemplate.fromTemplate("Use the provided API's to respond to this user query:\n\n{query}")
    ]),
    requestChain = new SimpleRequestChain(),
    verbose,
    ...rest
  } = options;
  const formatChain = new LLMChain({
    llm,
    prompt,
    outputKey: "function",
    // llmKwargs: { functions },
    verbose
  });
  return new SequentialChain({
    chains: [formatChain, requestChain],
    outputVariables: ["response"],
    inputVariables: formatChain.inputKeys,
    verbose,
    ...rest
  });
}