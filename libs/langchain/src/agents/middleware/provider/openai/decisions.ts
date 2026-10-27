type DecisionAnswer =
  | { type: "predicate"; probability: number }
  | {
      type: "choice";
      choice: string;
      confidence: number;
      probabilities: { value: string; probability: number }[];
    }
  | { type: "score" | "refusal" };

export type DecisionQuestions = Record<
  string,
  | { type: "predicate"; instructions: string }
  | { type: "choice"; instructions: string; choices: Record<string, string> }
>;

/** The part of `OpenAIDecisions` from `@langchain/openai` these middleware use. */
export interface OpenAIDecisionsLike {
  invoke(
    request: { input: never; questions: DecisionQuestions },
    config?: { signal?: AbortSignal }
  ): Promise<{ answers: Record<string, DecisionAnswer> }>;
}

async function loadDecisions(
  model: string | OpenAIDecisionsLike
): Promise<OpenAIDecisionsLike> {
  if (typeof model !== "string") return model;
  const pkg = "@langchain/openai";
  try {
    const { OpenAIDecisions } = await import(/* @vite-ignore */ pkg);
    return new OpenAIDecisions(model);
  } catch (error) {
    throw new Error(
      "OpenAI Decisions middleware requires @langchain/openai. Install it or pass an `OpenAIDecisions` instance as `model`.",
      { cause: error }
    );
  }
}

/** Asks a single question, loading the Decisions model on first use. */
export function decider(
  model: string | OpenAIDecisionsLike,
  questions: DecisionQuestions
) {
  let decisions: Promise<OpenAIDecisionsLike> | undefined;
  return async (input: unknown, signal?: AbortSignal) => {
    decisions ??= loadDecisions(model).catch((error) => {
      decisions = undefined;
      throw error;
    });
    const { answers } = await (
      await decisions
    ).invoke({ input: input as never, questions }, { signal });
    return Object.values(answers)[0];
  };
}
