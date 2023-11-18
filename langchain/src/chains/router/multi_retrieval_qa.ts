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
import { BaseRetriever } from "../../schema/retriever.js";
import { STRUCTURED_MULTI_RETRIEVAL_ROUTER_TEMPLATE } from "./multi_retrieval_prompt.js";
import { zipEntries } from "./utils.js";
import {
  RetrievalQAChain,
  RetrievalQAChainInput,
} from "../../chains/retrieval_qa.js";
import { RouterOutputParser } from "../../output_parsers/router.js";

/**
 * A type that represents the default values for the MultiRetrievalQAChain
 * class. It includes optional properties for the default retriever,
 * default prompt, and default chain.
 */
export type MultiRetrievalDefaults = {
  defaultRetriever?: BaseRetriever;
  defaultPrompt?: PromptTemplate;
  defaultChain?: BaseChain;
};

/**
 * A class that represents a multi-retrieval question answering chain in
 * the LangChain framework. It extends the MultiRouteChain class and
 * provides additional functionality specific to multi-retrieval QA
 * chains.
 * @example
 * ```typescript
 * const multiRetrievalQAChain = MultiRetrievalQAChain.fromLLMAndRetrievers(
 *   new ChatOpenAI(),
 *   {
 *     retrieverNames: ["aqua teen", "mst3k", "animaniacs"],
 *     retrieverDescriptions: [
 *       "Good for answering questions about Aqua Teen Hunger Force theme song",
 *       "Good for answering questions about Mystery Science Theater 3000 theme song",
 *       "Good for answering questions about Animaniacs theme song",
 *     ],
 *     retrievers: [
 *       new MemoryVectorStore().asRetriever(3),
 *       new MemoryVectorStore().asRetriever(3),
 *       new MemoryVectorStore().asRetriever(3),
 *     ],
 *     retrievalQAChainOpts: {
 *       returnSourceDocuments: true,
 *     },
 *   },
 * );
 *
 * const result = await multiRetrievalQAChain.call({
 *   input:
 *     "In the Aqua Teen Hunger Force theme song, who calls himself the mike rula?",
 * });
 *
 * console.log(result.sourceDocuments, result.text);
 * ```
 */
export class MultiRetrievalQAChain extends MultiRouteChain {
  get outputKeys(): string[] {
    return ["result"];
  }

  /**
   * @deprecated Use `fromRetrieversAndPrompts` instead
   */
  static fromRetrievers(
    llm: BaseLanguageModel,
    retrieverNames: string[],
    retrieverDescriptions: string[],
    retrievers: BaseRetriever[],
    retrieverPrompts?: PromptTemplate[],
    defaults?: MultiRetrievalDefaults,
    options?: Omit<MultiRouteChainInput, "defaultChain">
  ) {
    return MultiRetrievalQAChain.fromLLMAndRetrievers(llm, {
      retrieverNames,
      retrieverDescriptions,
      retrievers,
      retrieverPrompts,
      defaults,
      multiRetrievalChainOpts: options,
    });
  }

  /**
   * A static method that creates an instance of MultiRetrievalQAChain from
   * a BaseLanguageModel and a set of retrievers. It takes in optional
   * parameters for the retriever names, descriptions, prompts, defaults,
   * and additional options. It is an alternative method to fromRetrievers
   * and provides more flexibility in configuring the underlying chains.
   * @param llm A BaseLanguageModel instance.
   * @param retrieverNames An array of retriever names.
   * @param retrieverDescriptions An array of retriever descriptions.
   * @param retrievers An array of BaseRetriever instances.
   * @param retrieverPrompts An optional array of PromptTemplate instances for the retrievers.
   * @param defaults An optional MultiRetrievalDefaults instance.
   * @param multiRetrievalChainOpts Additional optional parameters for the multi-retrieval chain.
   * @param retrievalQAChainOpts Additional optional parameters for the retrieval QA chain.
   * @returns A new instance of MultiRetrievalQAChain.
   */
  static fromLLMAndRetrievers(
    llm: BaseLanguageModel,
    {
      retrieverNames,
      retrieverDescriptions,
      retrievers,
      retrieverPrompts,
      defaults,
      multiRetrievalChainOpts,
      retrievalQAChainOpts,
    }: {
      retrieverNames: string[];
      retrieverDescriptions: string[];
      retrievers: BaseRetriever[];
      retrieverPrompts?: PromptTemplate[];
      defaults?: MultiRetrievalDefaults;
      multiRetrievalChainOpts?: Omit<MultiRouteChainInput, "defaultChain">;
      retrievalQAChainOpts?: Partial<
        Omit<RetrievalQAChainInput, "retriever" | "combineDocumentsChain">
      > & {
        prompt?: PromptTemplate;
      };
    }
  ): MultiRetrievalQAChain {
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
        const opt: Partial<RetrievalQAChainInput> & {
          prompt?: PromptTemplate;
        } = retrievalQAChainOpts ?? {};
        if (prompt) {
          opt.prompt = prompt;
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
        ...retrievalQAChainOpts,
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
      ...multiRetrievalChainOpts,
      routerChain,
      destinationChains,
      defaultChain: _defaultChain,
    });
  }

  _chainType(): string {
    return "multi_retrieval_qa_chain";
  }
}
