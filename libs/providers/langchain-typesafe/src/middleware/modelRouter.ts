import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage } from "@langchain/core/messages";
import { createMiddleware, initChatModel } from "langchain";
import * as z from "zod";

import { TypeSafeClassifier } from "../classifier.js";
import type { TypeSafeClassifierFields } from "../classifier.js";
import type { ChoiceAnswer, JsonValue, QuestionContent } from "../types.js";

/** Question id sent to TypeSafe. Matches the Python package's `_QUESTION_ID`. */
const QUESTION_ID = "model_route";

/** A model available to the router, with the criterion for selecting it. */
export interface ModelChoice {
  /** A model instance, or a string accepted by `initChatModel`. */
  model: string | BaseChatModel;
  /** Description of the tasks this model suits. Becomes the Choice criterion. */
  criteria: JsonValue;
}

export interface ModelRouterMiddlewareConfig {
  /** Named choices. Must be non-empty; the criteria ARE the Choice criteria. */
  choices: Record<string, ModelChoice>;
  /** Extra guidance for the selection, e.g. "Choose the least costly model." */
  instructions: QuestionContent;
  /**
   * Transport and model settings forwarded to the classifier this middleware
   * builds — everything `TypeSafeClassifier` accepts EXCEPT `questions`.
   *
   * The question is the middleware's own business and cannot be supplied by
   * the caller: `TypeSafeClassifier.questions` is `readonly` and fixed at
   * construction, and `TypeSafeClassifierCallOptions` has no `questions`
   * field, so there is no way to bind one per call. Accepting a whole
   * classifier instance would therefore force the caller to author the very
   * criteria that `choices` already describes.
   *
   * Pass `fetch` here to make unit tests network-free.
   */
  classifierOptions?: Omit<TypeSafeClassifierFields, "questions">;
}

const stateSchema = z.object({
  modelRoute: z.custom<ChoiceAnswer>().optional(),
});

/**
 * Selects an agent's model with a TypeSafe `Choice` classification.
 *
 * Classifies the latest human message ONCE per agent run in `beforeAgent`,
 * stores the complete `ChoiceAnswer` in state, then reuses it for every model
 * call in the run. A ten-turn loop pays one classification; classifying per
 * model call would not be economic.
 *
 * The complete answer is stored rather than the winning label so probabilities
 * and confidence are visible in state and traces.
 *
 * Classifier failures propagate and end the run. A silent fallback to a
 * different model would make routing unauditable.
 */
export function modelRouterMiddleware(config: ModelRouterMiddlewareConfig) {
  const { choices, instructions, classifierOptions } = config;
  const routes = Object.keys(choices);
  if (routes.length === 0) {
    throw new Error("modelRouterMiddleware requires at least one entry in `choices`.");
  }

  const classifier = new TypeSafeClassifier({
    ...classifierOptions,
    questions: {
      [QUESTION_ID]: {
        type: "choice",
        instructions,
        criteria: Object.fromEntries(routes.map((r) => [r, choices[r].criteria])),
      },
    },
  });

  // `initChatModel` is async in JS while Python's `init_chat_model` is sync, so
  // string models cannot be resolved eagerly in this synchronous factory the way
  // the Python constructor does. Resolve on first use and memoise.
  const resolved = new Map<string, BaseChatModel>();
  async function modelFor(route: string): Promise<BaseChatModel> {
    const cached = resolved.get(route);
    if (cached !== undefined) return cached;
    const declared = choices[route]?.model;
    if (declared === undefined) {
      throw new Error(
        `modelRouterMiddleware: TypeSafe selected route "${route}", which is not in \`choices\`.`
      );
    }
    const model = typeof declared === "string" ? await initChatModel(declared) : declared;
    resolved.set(route, model);
    return model;
  }

  return createMiddleware({
    name: "TypeSafeModelRouter",
    stateSchema,

    async beforeAgent(state) {
      const messages = state.messages ?? [];
      let latest: HumanMessage | undefined;
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (HumanMessage.isInstance(message)) {
          latest = message;
          break;
        }
      }
      if (latest === undefined) {
        // Python uses a bare `next()` here, which raises StopIteration - not a
        // usable diagnostic. Name the middleware instead.
        throw new Error("modelRouterMiddleware: state contains no human message to route on.");
      }
      const response = await classifier.invoke(latest);
      return { modelRoute: response.choices[QUESTION_ID] };
    },

    async wrapModelCall(request, handler) {
      const answer = request.state.modelRoute;
      if (answer === undefined) {
        throw new Error(
          "modelRouterMiddleware: no routing answer in state. `beforeAgent` must run first."
        );
      }
      // JS has no `request.override(...)`; the convention is object spread.
      // See libs/langchain/src/agents/middleware/modelFallback.ts:63.
      return handler({ ...request, model: await modelFor(answer.choice) });
    },
  });
}
