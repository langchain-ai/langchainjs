import { z } from "zod/v4";
import { HumanMessage } from "@langchain/core/messages";
import { createMiddleware } from "../../../middleware.js";
import { initChatModel } from "../../../../chat_models/universal.js";
import type { AgentLanguageModelLike } from "../../../model.js";
import { decider, type OpenAIDecisionsLike } from "./decisions.js";

export interface ModelChoice {
  /** A chat model, or a model string accepted by `initChatModel`. */
  model: string | AgentLanguageModelLike;
  /** When to pick this model. */
  criteria: string;
}

export interface OpenAIModelRouterMiddlewareOptions {
  /** Named models and the criterion for choosing each. */
  choices: Record<string, ModelChoice>;
  /** The routing question, e.g. "Choose the least costly model for the task." */
  instructions: string;
  /** An `OpenAIDecisions` instance from `@langchain/openai`. */
  model: OpenAIDecisionsLike;
}

const routeSchema = z.object({
  choice: z.string(),
  confidence: z.number(),
  probabilities: z.array(
    z.object({ value: z.string(), probability: z.number() })
  ),
});

/**
 * Routes each agent run to one of several models with the OpenAI Decisions API
 * (beta).
 *
 * Classifies the latest human message once per run and stores the answer in
 * `modelRoute`, then uses the chosen model for every model call in that run. With
 * no human message, or a refusal, the agent's own model is used.
 */
export function openAIModelRouterMiddleware(
  options: OpenAIModelRouterMiddlewareOptions
) {
  const routes = Object.keys(options.choices);
  if (!routes.length)
    throw new Error(
      "openAIModelRouterMiddleware requires at least one choice."
    );
  if (!options.instructions.trim())
    throw new Error(
      "openAIModelRouterMiddleware instructions must not be empty."
    );
  const decide = decider(options.model, {
    model_route: {
      type: "choice",
      instructions: options.instructions,
      choices: Object.fromEntries(
        routes.map((route) => [route, options.choices[route].criteria])
      ),
    },
  });
  const models = new Map<string, Promise<AgentLanguageModelLike>>();
  const modelFor = (route: string) => {
    if (!Object.hasOwn(options.choices, route))
      throw new Error(`Unknown model route "${route}".`);
    if (!models.has(route)) {
      const choice = options.choices[route];
      const pending = Promise.resolve(
        typeof choice.model === "string"
          ? initChatModel(choice.model)
          : choice.model
      );
      pending.catch(() => models.delete(route));
      models.set(route, pending);
    }
    return models.get(route)!;
  };

  return createMiddleware({
    name: "OpenAIModelRouterMiddleware",
    stateSchema: z.object({ modelRoute: routeSchema.nullable().optional() }),
    async beforeAgent(state, runtime) {
      const message = [...state.messages]
        .reverse()
        .find((message) => HumanMessage.isInstance(message));
      if (!message) return { modelRoute: null };
      const answer = await decide(message, runtime.signal);
      if (answer?.type !== "choice") return { modelRoute: null };
      if (!Object.hasOwn(options.choices, answer.choice))
        throw new Error(
          `OpenAI Decisions selected unknown model route "${answer.choice}".`
        );
      const { choice, confidence, probabilities } = answer;
      return { modelRoute: { choice, confidence, probabilities } };
    },
    async wrapModelCall(request, handler) {
      const route = request.state.modelRoute;
      if (!route) return handler(request);
      return handler({ ...request, model: await modelFor(route.choice) });
    },
  });
}
