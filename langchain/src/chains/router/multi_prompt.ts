import { z } from "zod";
import { BaseLanguageModel } from "../../base_language/index.js";
import { MultiRouteChain, MultiRouteChainInput } from "./multi_route.js";
import { STRUCTURED_MULTI_PROMPT_ROUTER_TEMPLATE } from "./multi_prompt_prompt.js";
import { BaseChain } from "../../chains/base.js";
import { interpolateFString } from "../../prompts/template.js";
import { LLMChain, LLMChainInput } from "../../chains/llm_chain.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { LLMRouterChain } from "./llm_router.js";
import { ConversationChain } from "../../chains/conversation.js";
import { zipEntries } from "./utils.js";
import { RouterOutputParser } from "../../output_parsers/router.js";

/**
 * A class that represents a multi-prompt chain in the LangChain
 * framework. It extends the MultiRouteChain class and provides additional
 * functionality specific to multi-prompt chains.
 * @example
 * ```typescript
 * const multiPromptChain = MultiPromptChain.fromLLMAndPrompts(new ChatOpenAI(), {
 *   promptNames: ["physics", "math", "history"],
 *   promptDescriptions: [
 *     "Good for answering questions about physics",
 *     "Good for answering math questions",
 *     "Good for answering questions about history",
 *   ],
 *   promptTemplates: [
 *     `You are a very smart physics professor. Here is a question:\n{input}\n`,
 *     `You are a very good mathematician. Here is a question:\n{input}\n`,
 *     `You are a very smart history professor. Here is a question:\n{input}\n`,
 *   ],
 * });
 * const result = await multiPromptChain.call({
 *   input: "What is the speed of light?",
 * });
 * ```
 */
export class MultiPromptChain extends MultiRouteChain {
  /**
   * @deprecated Use `fromLLMAndPrompts` instead
   */
  static fromPrompts(
    llm: BaseLanguageModel,
    promptNames: string[],
    promptDescriptions: string[],
    promptTemplates: string[] | PromptTemplate[],
    defaultChain?: BaseChain,
    options?: Omit<MultiRouteChainInput, "defaultChain">
  ) {
    return MultiPromptChain.fromLLMAndPrompts(llm, {
      promptNames,
      promptDescriptions,
      promptTemplates,
      defaultChain,
      multiRouteChainOpts: options,
    });
  }

  /**
   * A static method that creates an instance of MultiPromptChain from a
   * BaseLanguageModel and a set of prompts. It takes in optional parameters
   * for the default chain and additional options.
   * @param llm A BaseLanguageModel instance.
   * @param promptNames An array of prompt names.
   * @param promptDescriptions An array of prompt descriptions.
   * @param promptTemplates An array of prompt templates.
   * @param defaultChain An optional BaseChain instance to be used as the default chain.
   * @param llmChainOpts Optional parameters for the LLMChainInput, excluding 'llm' and 'prompt'.
   * @param conversationChainOpts Optional parameters for the LLMChainInput, excluding 'llm' and 'outputKey'.
   * @param multiRouteChainOpts Optional parameters for the MultiRouteChainInput, excluding 'defaultChain'.
   * @returns An instance of MultiPromptChain.
   */
  static fromLLMAndPrompts(
    llm: BaseLanguageModel,
    {
      promptNames,
      promptDescriptions,
      promptTemplates,
      defaultChain,
      llmChainOpts,
      conversationChainOpts,
      multiRouteChainOpts,
    }: {
      promptNames: string[];
      promptDescriptions: string[];
      promptTemplates: string[] | PromptTemplate[];
      defaultChain?: BaseChain;
      llmChainOpts?: Omit<LLMChainInput, "llm" | "prompt">;
      conversationChainOpts?: Omit<LLMChainInput, "llm" | "outputKey">;
      multiRouteChainOpts?: Omit<MultiRouteChainInput, "defaultChain">;
    }
  ): MultiPromptChain {
    const destinations = zipEntries(promptNames, promptDescriptions).map(
      ([name, desc]) => `${name}: ${desc}`
    );

    const structuredOutputParserSchema = z.object({
      destination: z
        .string()
        .optional()
        .describe('name of the question answering system to use or "DEFAULT"'),
      next_inputs: z
        .object({
          input: z
            .string()
            .describe("a potentially modified version of the original input"),
        })
        .describe("input to be fed to the next model"),
    });

    const outputParser = new RouterOutputParser(structuredOutputParserSchema);

    const destinationsStr = destinations.join("\n");
    const routerTemplate = interpolateFString(
      STRUCTURED_MULTI_PROMPT_ROUTER_TEMPLATE(
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
    const destinationChains = zipEntries<[string, string | PromptTemplate]>(
      promptNames,
      promptTemplates
    ).reduce((acc, [name, template]) => {
      let myPrompt: string | PromptTemplate;
      if (typeof template === "object") {
        myPrompt = template;
      } else if (typeof template === "string") {
        myPrompt = new PromptTemplate({
          template: template as string,
          inputVariables: ["input"],
        });
      } else {
        throw new Error("Invalid prompt template");
      }
      acc[name as string] = new LLMChain({
        ...llmChainOpts,
        llm,
        prompt: myPrompt,
      });
      return acc;
    }, {} as { [name: string]: LLMChain });

    const convChain = new ConversationChain({
      ...conversationChainOpts,
      llm,
      outputKey: "text",
    });

    return new MultiPromptChain({
      ...multiRouteChainOpts,
      routerChain,
      destinationChains,
      defaultChain: defaultChain ?? convChain,
    });
  }

  _chainType(): string {
    return "multi_prompt_chain";
  }
}
