import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, type BaseMessage } from "@langchain/core/messages";
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

const modelChoiceSchema = z.object({
  model: z.union([
    z.string().nonempty("`model` must be a non-empty model name."),
    // Structural, not `z.instanceof`: two copies of @langchain/core in a
    // dependency tree make `instanceof` fail, which is why this repo uses
    // `.isInstance()` brand checks. `z.custom` also passes the value
    // through by reference, so a live instance survives unchanged.
    z.custom<BaseChatModel>(
      (value) => typeof value === "object" && value !== null,
      "`model` must be a model name or a chat model instance."
    ),
  ]),
  criteria: z.json(),
});

/**
 * Checks every choice, naming the route in any error, and returns the
 * caller's own map.
 *
 * Not `z.record(...)`: that rebuilds the map and drops a key named
 * `__proto__`, so a route so named would vanish from the generated
 * question with no error. Returning the input also keeps each
 * `BaseChatModel` instance's identity.
 */
export function parseChoices(
  choices: Record<string, ModelChoice>
): Record<string, ModelChoice> {
  const routes = Object.keys(choices);
  if (routes.length === 0) {
    throw new Error(
      "modelRouterMiddleware requires at least one entry in `choices`."
    );
  }
  for (const route of routes) {
    const shape = modelChoiceSchema.safeParse(choices[route]);
    if (!shape.success) {
      throw new Error(
        `modelRouterMiddleware: choice "${route}": ${shape.error.issues[0].message}`
      );
    }
  }
  return choices;
}

/** The model a route declares, resolving a name through `initChatModel`. */
export async function resolveModel(
  choices: Record<string, ModelChoice>,
  route: string
): Promise<BaseChatModel> {
  const declared = choices[route]?.model;
  if (declared === undefined) {
    throw new Error(
      `modelRouterMiddleware: TypeSafe selected route "${route}", which is not in \`choices\`.`
    );
  }
  return typeof declared === "string" ? initChatModel(declared) : declared;
}

/**
 * Wraps `resolveModel` in a per-route cache.
 *
 * A cache is needed because `initChatModel` is async in JS while Python's
 * `init_chat_model` is sync, so a name cannot be resolved eagerly in the
 * synchronous factory the way the Python constructor does. Without it,
 * `wrapModelCall` would build a fresh client on every turn of every run.
 *
 * It caches the promise, not the model, so two concurrent runs on the same
 * route share one `initChatModel` call instead of both starting one. A
 * rejection is evicted, so a failure is not cached.
 */
export function createModelResolver(
  choices: Record<string, ModelChoice>
): (route: string) => Promise<BaseChatModel> {
  const cache = new Map<string, Promise<BaseChatModel>>();
  return (route) => {
    const cached = cache.get(route);
    if (cached !== undefined) return cached;
    const pending = resolveModel(choices, route).catch((error: unknown) => {
      cache.delete(route);
      throw error;
    });
    cache.set(route, pending);
    return pending;
  };
}

/**
 * The most recent human message, or `undefined`.
 *
 * Python uses a bare `next()`, whose `StopIteration` is not a usable
 * diagnostic; the caller raises a named error instead.
 */
export function latestHumanMessage(
  messages: BaseMessage[]
): HumanMessage | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (HumanMessage.isInstance(message)) return message;
  }
  return undefined;
}

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
 * different model would make routing unauditable. Classification happens in
 * `beforeAgent`, which the agent does not wrap, so those errors arrive as
 * this package's own error types. A failure in `wrapModelCall` — an
 * unresolvable model, say — is wrapped in `MiddlewareError`
 * (`agents/nodes/AgentNode.ts:701`) and must be read via `err.cause`.
 */
export function modelRouterMiddleware(config: ModelRouterMiddlewareConfig) {
  const { choices: choicesInput, instructions, classifierOptions } = config;
  const choices = parseChoices(choicesInput);
  const routes = Object.keys(choices);

  const classifier = new TypeSafeClassifier({
    ...classifierOptions,
    questions: {
      [QUESTION_ID]: {
        type: "choice",
        instructions,
        criteria: Object.fromEntries(
          routes.map((r) => [r, choices[r].criteria])
        ),
      },
    },
  });

  const modelFor = createModelResolver(choices);

  return createMiddleware({
    name: "TypeSafeModelRouterMiddleware",
    stateSchema,

    async beforeAgent(state) {
      const latest = latestHumanMessage(state.messages ?? []);
      if (latest === undefined) {
        throw new Error(
          "modelRouterMiddleware: state contains no human message to route on."
        );
      }
      const response = await classifier.invoke(latest);
      const answer = response.choices[QUESTION_ID];
      if (answer === undefined) {
        throw new Error(
          `modelRouterMiddleware: TypeSafe returned no answer for question "${QUESTION_ID}".`
        );
      }
      return { modelRoute: answer };
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
