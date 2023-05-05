import { BasePromptTemplate, LLMChain } from "index.js";
import { RouterChain } from "./multi_route.js";
import { CallbackManagerForChainRun } from "callbacks/manager.js";
import { ChainValues } from "schema/index.js";
import { BaseLanguageModel } from "base_language/index.js";
import { ChainInputs } from "chains/base.js";
import { StructuredOutputParser } from "output_parsers/structured.js";
import { z } from "zod";

export type RouterOutputSchema = z.ZodObject<{
  destination: z.ZodNullable<z.ZodString>;
  next_inputs: z.ZodRecord<z.ZodString, z.ZodAny>;
}>;

export type RouterInputSchema = z.ZodObject<{
  destination: z.ZodNullable<z.ZodString>;
  next_inputs: z.ZodString;
}>;

export type RouterOutputParserInput = {
  defaultDestination?: string;
  nextInputInnerKey?: string;
};

export interface LLMRouterChainInput extends ChainInputs {
  llmChain: LLMChain<z.infer<RouterOutputSchema>>;
}

export class LLMRouterChain extends RouterChain {
  llmChain: LLMChain<z.infer<RouterOutputSchema>>;
  constructor(fields: LLMRouterChainInput) {
    super(fields.memory, fields.verbose, fields.callbackManager);
    this.llmChain = fields.llmChain;
  }

  get inputKeys(): string[] {
    return this.llmChain.inputKeys;
  }

  async _call(
    values: ChainValues,
    runManager?: CallbackManagerForChainRun | undefined
  ): Promise<ChainValues> {
    return this.llmChain.predict(values, runManager?.getChild());
  }

  _chainType(): string {
    return "llm_router_chain";
  }

  static fromLLM(
    llm: BaseLanguageModel,
    prompt: BasePromptTemplate,
    options?: Omit<LLMRouterChainInput, "llm">
  ) {
    const llmChain = new LLMChain<z.infer<RouterOutputSchema>>({ llm, prompt });
    return new LLMRouterChain({ ...options, llmChain });
  }
}

export class RouterOutputParser extends StructuredOutputParser<RouterOutputSchema> {
  defaultDestination: string = "DEFAULT";
  nextInputInnerKey: string = "input";
  inputParser: StructuredOutputParser<RouterInputSchema>;

  constructor(fields?: RouterOutputParserInput) {
    super(
      z.object({
        destination: z.string().nullable().describe("Name of the next chain"),
        next_inputs: z.record(z.string(), z.any()).describe("Input name"),
      })
    );
    this.inputParser = StructuredOutputParser.fromZodSchema(
      z.object({
        destination: z.string().nullable().describe("Name of the next chain"),
        next_inputs: z.string().describe("Raw input string"),
      })
    );
    this.defaultDestination =
      fields?.defaultDestination ?? this.defaultDestination;
    this.nextInputInnerKey =
      fields?.nextInputInnerKey ?? this.nextInputInnerKey;
  }

  async parse(text: string): Promise<z.infer<RouterOutputSchema>> {
    try {
      const parsedText = await this.inputParser.parse(text);

      if (
        parsedText.destination?.toLowerCase() ===
        this.defaultDestination.toLowerCase()
      ) {
        parsedText.destination = null;
      }

      const result: z.infer<RouterOutputSchema> = {
        destination: parsedText.destination,
        next_inputs: { [this.nextInputInnerKey]: parsedText.next_inputs },
      };
      return result;
    } catch (e) {
      throw e;
    }
  }
}
