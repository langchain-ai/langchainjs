import { BaseLanguageModel } from "base_language/index.js";
import { MultiRouteChain, MultiRouteChainInput } from "./multi_route.js";
import { MULTI_PROMPT_ROUTER_TEMPLATE } from "./multi_prompt_prompt.js";
import { BaseChain } from "chains/base.js";
import { interpolateFString } from "prompts/template.js";
import { LLMChain, PromptTemplate } from "index.js";
import { LLMRouterChain, RouterOutputParser } from "./llm_router.js";
import { ConversationChain } from "chains/conversation.js";
import { zipEntries } from "./utils.js";

export class MultiPromptChain extends MultiRouteChain {
  static fromPrompts(
    llm: BaseLanguageModel,
    promptNames: string[],
    promptDescriptions: string[],
    promptTemplates: string[],
    defaultChain?: BaseChain,
    options?: Omit<MultiRouteChainInput, "defaultChain">
  ) {
    const destinations = zipEntries(promptNames, promptDescriptions).map(
      ([name, desc]) => {
        return `${name}: ${desc}`;
      }
    );

    const destinationsStr = destinations.join("\n");
    const routerTemplate = interpolateFString(MULTI_PROMPT_ROUTER_TEMPLATE, {
      destinations: destinationsStr,
    });
    const routerPrompt = new PromptTemplate({
      template: routerTemplate,
      inputVariables: ["input"],
      outputParser: new RouterOutputParser(),
    });

    const routerChain = LLMRouterChain.fromLLM(llm, routerPrompt);
    const destinationChains = zipEntries(promptNames, promptTemplates).reduce(
      (acc, [name, template]) => {
        acc[name as string] = new LLMChain({
          llm,
          prompt: new PromptTemplate({
            template: template as string,
            inputVariables: ["input"],
          }),
        });
        return acc;
      },
      {} as { [name: string]: LLMChain }
    );

    const convChain = new ConversationChain({
      llm,
      outputKey: "text",
    });

    return new MultiPromptChain({
      routerChain,
      destinationChains,
      defaultChain: defaultChain ?? convChain,
      ...options,
    });
  }
}
