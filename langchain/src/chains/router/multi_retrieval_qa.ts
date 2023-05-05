import { BaseLanguageModel } from "base_language/index.js";
import { MultiRouteChain, MultiRouteChainInput } from "./multi_route.js";
import { BaseChain } from "chains/base.js";
import { interpolateFString } from "prompts/template.js";
import { PromptTemplate } from "index.js";
import { LLMRouterChain, RouterOutputParser } from "./llm_router.js";
import { ConversationChain, DEFAULT_TEMPLATE } from "chains/conversation.js";
import { BaseRetriever } from "schema/index.js";
import { MULTI_RETRIEVAL_ROUTER_TEMPLATE } from "./multi_retrieval_prompt.js";
import { zipEntries } from "./utils.js";
import { RetrievalQAChain } from "chains/retrieval_qa.js";

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
    defaultRetriever?: BaseRetriever,
    defaultPrompt?: PromptTemplate,
    defaultChain?: BaseChain,
    options?: Omit<MultiRouteChainInput, "defaultChain">
  ) {
    if (defaultPrompt && !defaultRetriever) {
      throw new Error(
        "`default_retriever` must be specified if `default_prompt` is \nprovided. Received only `default_prompt`."
      );
    }
    const destinations = zipEntries(retrieverNames, retrieverDescriptions).map(
      ([name, desc]) => {
        return `${name}: ${desc}`;
      }
    );

    const destinationsStr = destinations.join("\n");
    const routerTemplate = interpolateFString(MULTI_RETRIEVAL_ROUTER_TEMPLATE, {
      destinations: destinationsStr,
    });
    const routerPrompt = new PromptTemplate({
      template: routerTemplate,
      inputVariables: ["input"],
      outputParser: new RouterOutputParser(),
    });

    const routerChain = LLMRouterChain.fromLLM(llm, routerPrompt);
    const prompts = retrieverPrompts ?? retrievers.map(() => null);
    const destinationChains = zipEntries(
      retrieverNames,
      retrievers,
      prompts
    ).reduce((acc, [name, retriever, prompt]) => {
      acc[name as string] = RetrievalQAChain.fromLLM(
        llm,
        retriever as BaseRetriever,
        { prompt: prompt as PromptTemplate }
      );
      return acc;
    }, {} as { [name: string]: RetrievalQAChain });

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
}
