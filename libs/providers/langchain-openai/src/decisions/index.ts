import { OpenAI as OpenAIClient, type ClientOptions } from "openai";
import { z } from "zod/v3";
import {
  Runnable,
  getCallbackManagerForConfig,
  type RunnableConfig,
} from "@langchain/core/runnables";
import type { ChatGeneration } from "@langchain/core/outputs";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { wrapOpenAIClientError } from "../utils/client.js";
import { toDecisionInput } from "./input.js";
import {
  answerSchema,
  toQuestion,
  type DecisionRequest,
  type DecisionResponse,
} from "./types.js";
export * from "./types.js";

export interface OpenAIDecisionsFields {
  model: string;
  apiKey?: ClientOptions["apiKey"];
  configuration?: Omit<ClientOptions, "apiKey">;
}
const wireSchema = z.object({
  model: z.string(),
  answers: z.array(
    z.object({ name: z.string(), type: z.string() }).passthrough()
  ),
  usage: z
    .object({
      input_tokens: z.number().int().nonnegative().nullish(),
      output_tokens: z.number().int().nonnegative().nullish(),
    })
    .nullish(),
});

/** Beta runnable for the OpenAI Decisions API. */
export class OpenAIDecisions extends Runnable<
  DecisionRequest,
  DecisionResponse
> {
  lc_namespace = ["langchain", "openai", "decisions"];
  model: string;
  apiKey?: ClientOptions["apiKey"];
  private client: OpenAIClient;
  get lc_secrets() {
    return { apiKey: "OPENAI_API_KEY" };
  }
  constructor(fields: OpenAIDecisionsFields) {
    super({ model: fields.model, apiKey: fields.apiKey });
    if (!fields.model?.length)
      throw new Error("A decisions model is required.");
    this.model = fields.model;
    this.apiKey = fields.apiKey ?? getEnvironmentVariable("OPENAI_API_KEY");
    this.client = new OpenAIClient({
      ...fields.configuration,
      apiKey: this.apiKey,
    });
  }
  async invoke(
    input: DecisionRequest,
    config?: RunnableConfig
  ): Promise<DecisionResponse> {
    const options = {
      ...config,
      metadata: {
        ...config?.metadata,
        ls_provider: "openai",
        ls_model_name: this.model,
        ls_model_type: "chat",
      },
    };
    const manager = await getCallbackManagerForConfig(options);
    const [runManager] =
      (await manager?.handleChatModelStart(
        this.toJSON(),
        [[new HumanMessage(JSON.stringify(input))]],
        options.runId,
        undefined,
        undefined,
        undefined,
        undefined,
        options.runName ?? this.getName()
      )) ?? [];
    try {
      const body = {
        model: this.model,
        input: toDecisionInput(input.input),
        questions: Object.entries(input.questions).map(([name, question]) =>
          toQuestion(name, question)
        ),
      };
      const { data, response } = await this.client
        .post<unknown>("/decisions", { body, signal: config?.signal })
        .withResponse();
      const wire = wireSchema.parse(data);
      const answers: DecisionResponse["answers"] = Object.create(null);
      for (const answer of wire.answers) {
        if (!["predicate", "choice", "score", "refusal"].includes(answer.type))
          continue;
        let normalized: Record<string, unknown> = answer;
        if (answer.type === "choice" || answer.type === "score") {
          const probabilities = z
            .array(
              z.object({
                value: z.union([z.string(), z.boolean(), z.number()]),
                probability: z.number(),
                label: z.string().optional(),
              })
            )
            .parse(answer.probabilities);
          normalized = {
            ...answer,
            probabilities: Object.fromEntries(
              probabilities.map((item) => [
                String(item.value),
                item.probability,
              ])
            ),
          };
          if (answer.type === "score")
            normalized.legend = Object.fromEntries(
              probabilities.map((item) => [String(item.value), item.label])
            );
        }
        answers[answer.name] = answerSchema.parse(normalized);
      }
      const usage = wire.usage ?? {};
      const usage_metadata = {
        input_tokens: usage.input_tokens ?? 0,
        output_tokens: usage.output_tokens ?? 0,
        total_tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
      };
      const result: DecisionResponse = {
        model: wire.model,
        answers,
        predicates: Object.create(null),
        choices: Object.create(null),
        scores: Object.create(null),
        refusals: Object.create(null),
        usage,
        usage_metadata,
        request_id: response.headers.get("x-request-id"),
      };
      for (const [name, answer] of Object.entries(answers)) {
        if (answer.type === "predicate") result.predicates[name] = answer;
        else if (answer.type === "choice") result.choices[name] = answer;
        else if (answer.type === "score") result.scores[name] = answer;
        else result.refusals[name] = answer;
      }
      await runManager?.handleLLMEnd({
        generations: [
          [
            {
              text: "",
              message: new AIMessage({
                content: JSON.stringify(result),
                usage_metadata,
              }),
            } as ChatGeneration,
          ],
        ],
        llmOutput: { ...result },
      });
      return result;
    } catch (error) {
      const wrapped = wrapOpenAIClientError(error);
      await runManager?.handleLLMError(wrapped);
      throw wrapped;
    }
  }
}
