import { vi } from "vitest";
import { OpenAIDecisions } from "@langchain/openai";

export function decisions(answers: Record<string, unknown>[] | Error) {
  const fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (answers instanceof Error) throw answers;
    const { questions } = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        model: "m",
        answers: answers.map((answer) => ({
          name: questions[0].name,
          ...answer,
        })),
      }),
      { headers: { "content-type": "application/json" } }
    );
  });
  const model = new OpenAIDecisions({
    model: "m",
    apiKey: "test",
    configuration: { fetch, maxRetries: 0 },
  });
  const sent = (call = 0) =>
    JSON.parse(String(fetch.mock.calls[call][1]?.body));
  return { model, fetch, sent };
}
