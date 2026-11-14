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

/** Asks a single question and returns its answer. */
export function decider(
  model: OpenAIDecisionsLike,
  questions: DecisionQuestions
) {
  return async (input: unknown, signal?: AbortSignal) => {
    const { answers } = await model.invoke(
      { input: input as never, questions },
      { signal }
    );
    return Object.values(answers)[0];
  };
}
