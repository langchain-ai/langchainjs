import { z } from "zod";
import { BaseLanguageModel } from "../../base_language/index.js";
import { MultiRouteChain, MultiRouteChainInput } from "./multi_route.js";
import { BaseChain } from "../../chains/base.js";
import { interpolateFString } from "../../prompts/template.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { LLMRouterChain } from "./llm_router.js";
import {
  ConversationChain,
  DEFAULT_TEMPLATE,
} from "../../chains/conversation.js";
import { BaseRetriever } from "../../schema/index.js";
import { STRUCTURED_MULTI_RETRIEVAL_ROUTER_TEMPLATE } from "./multi_retrieval_prompt.js";
import { zipEntries } from "./utils.js";
import { RetrievalQAChain } from "../../chains/retrieval_qa.js";
import { RouterOutputParser } from "../../output_parsers/router.js";

export type MultiRetrievalDefaults = {
  defaultRetriever?: BaseRetriever;
  defaultPrompt?: PromptTemplate;
  defaultChain?: BaseChain;
};

export class MultiRetrievalQAChain extends MultiRouteChain {
  get outputKeys(): string[] {
    return ["result"];
  }

  static fromRetrievers(
    llm: BaseLanguageModel,
    retrieverNames: string[],
    retrieverDescriptions: string[],
    retrievers: BaseRetriever[],
    retrieverPrompts?: PromptTemplate[],
    defaults?: MultiRetrievalDefaults,
    options?: Omit<MultiRouteChainInput, "defaultChain">
  ) {
    const { defaultRetriever, defaultPrompt, defaultChain } = defaults ?? {};
    if (defaultPrompt && !defaultRetriever) {
      throw new Error(
        "`default_retriever` must be specified if `default_prompt` is \nprovided. Received only `default_prompt`."
      );
    }
    const destinations = zipEntries<[string, string]>(
      retrieverNames,
      retrieverDescriptions
    ).map(([name, desc]) => `${name}: ${desc}`);

    const structuredOutputParserSchema = z.object({
      destination: z
        .string()
        .optional()
        .describe('name of the question answering system to use or "DEFAULT"'),
      next_inputs: z
        .object({
          query: z
            .string()
            .describe("a potentially modified version of the original input"),
        })
        .describe("input to be fed to the next model"),
    });

    const outputParser = new RouterOutputParser<
      typeof structuredOutputParserSchema
    >(structuredOutputParserSchema);

    const destinationsStr = destinations.join("\n");
    const routerTemplate = interpolateFString(
      STRUCTURED_MULTI_RETRIEVAL_ROUTER_TEMPLATE(
        outputParser.getFormatInstructions({ interpolationDepth: 4 })
      ),
      {
        destinations: destinationsStr,
      }
    );
    const routerPrompt = new PromptTemplate({
      template: routerTemplate,
      inputVariables: ["input"],
      outputParser,
    });

    const routerChain = LLMRouterChain.fromLLM(llm, routerPrompt);
    const prompts = retrieverPrompts ?? retrievers.map(() => null);
    const destinationChains = zipEntries<
      [string, BaseRetriever, PromptTemplate | null]
    >(retrieverNames, retrievers, prompts).reduce(
      (acc, [name, retriever, prompt]) => {
        let opt: { prompt: PromptTemplate } | undefined;
        if (prompt) {
          opt = { prompt };
        }
        acc[name] = RetrievalQAChain.fromLLM(llm, retriever, opt);
        return acc;
      },
      {} as { [name: string]: RetrievalQAChain }
    );

    let _defaultChain;
    if (defaultChain) {
      _defaultChain = defaultChain;
    } else if (defaultRetriever) {
      _defaultChain = RetrievalQAChain.fromLLM(llm, defaultRetriever, {
        prompt: defaultPrompt,
      });
    } else {
      const promptTemplate = DEFAULT_TEMPLATE.replace("input", "query");
      const prompt = new PromptTemplate({
        template: promptTemplate,
        inputVariables: ["history", "query"],
      });
      _defaultChain = new ConversationChain({
        llm,
        prompt,
        outputKey: "result",
      });
    }

    return new MultiRetrievalQAChain({
      routerChain,
      destinationChains,
      defaultChain: _defaultChain,
      ...options,
    });
  }

  _chainType(): string {
    return "multi_retrieval_qa_chain";
  }
}
