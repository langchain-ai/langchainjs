import type {
  BaseDecisionModel,
  ChoiceAnswer,
  Content,
  JsonValue,
  Question,
} from "@langchain/core/decisions";
import { HumanMessage } from "@langchain/core/messages";
import { omitPayload } from "@langchain/core/tracers/tracer_langchain";
import { z } from "zod/v4";

import { initChatModel } from "../../chat_models/universal.js";
import { createMiddleware } from "../middleware.js";
import type { AgentLanguageModelLike } from "../model.js";

const QUESTION_ID = "model_route";

/** A model available to the router and the criterion for selecting it. */
export interface ModelChoice {
  /** A chat model, or a model string accepted by `initChatModel`. */
  model: string | AgentLanguageModelLike;
  /** Description of the tasks suited to the model. */
  criteria: JsonValue;
}

export interface ModelRouterMiddlewareConfig {
  /**
   * Named model choices, each containing a model and the criterion for
   * selecting it.
   */
  choices: Record<string, ModelChoice>;
  /** Instructions the classifier should follow when selecting a route. */
  instructions: Content;
  /** Decision model used to select a route. */
  classifier: BaseDecisionModel;
}

/**
 * Select an agent's model with a decision model's `Choice` answer (beta).
 *
 * The middleware classifies the latest human message once before an agent
 * run, stores the complete `ChoiceAnswer` in agent state as `modelRoute`, and
 * uses its selected label for every model call in the run. Keeping the
 * complete answer makes probabilities and confidence available in state and
 * traces. Classifier failures propagate and terminate the run rather than
 * silently selecting a different model.
 *
 * @example
 * ```ts
 * import { createAgent, modelRouterMiddleware } from "langchain";
 *
 * const router = modelRouterMiddleware({
 *   choices: {
 *     fast: {
 *       model: "openai:gpt-5-mini",
 *       criteria: "Simple, well-scoped tasks.",
 *     },
 *     powerful: {
 *       model: powerfulModel,
 *       criteria: "Complex tasks requiring deeper reasoning.",
 *     },
 *   },
 *   instructions: "Choose the least costly model suited to the task.",
 *   classifier,
 * });
 * const agent = createAgent({
 *   model: "openai:gpt-5-mini",
 *   middleware: [router],
 * });
 * ```
 *
 * @throws Error if `choices` is empty.
 */
export function modelRouterMiddleware(config: ModelRouterMiddlewareConfig) {
  const { choices, instructions, classifier } = config;
  const routes = Object.keys(choices);
  if (routes.length === 0) {
    throw new Error("modelRouterMiddleware requires at least one choice.");
  }
  const questions: Record<string, Question> = {
    [QUESTION_ID]: {
      type: "choice",
      instructions,
      criteria: Object.fromEntries(
        routes.map((route) => [route, choices[route].criteria])
      ),
    },
  };

  // Caches the promise so concurrent runs share one `initChatModel` call.
  const models = new Map<string, Promise<AgentLanguageModelLike>>();
  const modelFor = (route: string) => {
    let pending = models.get(route);
    if (pending === undefined) {
      const { model } = choices[route];
      pending = Promise.resolve(
        typeof model === "string" ? initChatModel(model) : model
      );
      pending.catch(() => models.delete(route));
      models.set(route, pending);
    }
    return pending;
  };

  return createMiddleware({
    name: "ModelRouterMiddleware",
    stateSchema: z.object({ modelRoute: z.custom<ChoiceAnswer>().optional() }),
    tracePolicy: { processInputs: omitPayload },
    async beforeAgent(state, runtime) {
      const message = [...state.messages]
        .reverse()
        .find((candidate) => HumanMessage.isInstance(candidate));
      if (message === undefined) {
        throw new Error(
          "modelRouterMiddleware requires a HumanMessage in the agent state to route on."
        );
      }
      const response = await classifier.invoke(
        { state: message, questions },
        { signal: runtime.signal }
      );
      const answer = response.choices[QUESTION_ID];
      if (!Object.hasOwn(choices, answer.choice)) {
        throw new Error(
          `modelRouterMiddleware: the classifier selected unknown route "${answer.choice}".`
        );
      }
      return { modelRoute: answer };
    },
    async wrapModelCall(request, handler) {
      const route = request.state.modelRoute;
      if (route === undefined) {
        throw new Error(
          "modelRouterMiddleware found no routing answer in state."
        );
      }
      return handler({ ...request, model: await modelFor(route.choice) });
    },
  });
}
