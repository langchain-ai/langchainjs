# @langchain/typesafe

This package contains the LangChain.js integration for [TypeSafe](https://typesafe.ai) System One models.

TypeSafe's `jev` model answers typed questions about unstructured input — no string generation, no parsing, no schema wrangling. It returns calibrated probabilities in 70–500ms, and every question in a single request is evaluated in parallel, so asking ten questions costs barely more than asking one.

## Installation

```bash npm2yarn
npm install @langchain/typesafe @langchain/core
```

This package passes `@langchain/core` as a peer dependency. Make sure your project resolves a single instance of it:

```json
{
  "overrides": { "@langchain/core": "^1.0.0" },
  "resolutions": { "@langchain/core": "^1.0.0" },
  "pnpm": { "overrides": { "@langchain/core": "^1.0.0" } }
}
```

## Usage

Set `TYPESAFE_API_KEY` in your environment, then:

```ts
import { TypeSafeClassifier } from "@langchain/typesafe";

const classifier = new TypeSafeClassifier({
  questions: {
    department: {
      type: "choice",
      criteria: {
        billing: "Payment and payout issues",
        technical: "Bugs and outages",
        sales: null,
      },
      instructions: "Which team should handle this?",
    },
    urgent: { type: "noul", instructions: "Does this convey urgency?" },
    frustration: {
      type: "score",
      criteria: ["calm", "frustrated", "angry"],
      instructions: "How frustrated is the writer?",
    },
  },
});

const result = await classifier.invoke({
  message: "Help! My payouts have been failing for 3 days.",
  account_tier: "enterprise",
});

result.answers.department; // { type: "choice", choice: "billing", confidence: 0.99, probabilities: {...} }
result.answers.urgent; // { type: "noul", noul: 0.97 }
result.answers.frustration; // { type: "score", score: 1.3, legend: { 0: "calm", ... }, ... }
```

`result.model` is the versioned model that actually answered (e.g. `jev-1.13.0`), not the alias you sent — `jev-latest` in, `jev-1.13.0` out.

Three read-only, non-enumerable helpers partition `answers` by variant, keyed by question id — handy when you only care about one kind of question:

```ts
result.choices.department; // same object as result.answers.department
result.nouls.urgent;
result.scores.frustration;
```

Because they're non-enumerable, they never duplicate `answers` in `JSON.stringify(result)` or a LangSmith trace.

### Question types

| Type     | Ask                                         | Get back                                                                                     |
| -------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `choice` | pick one of N labels you define             | the winning label, the full distribution, and a confidence                                   |
| `score`  | position on an ordered rubric (low to high) | a probability-weighted number that may land _between_ levels, plus a legend and distribution |
| `noul`   | a single yes/no proposition                 | a bare probability from 0 to 1                                                               |

A Noul answer carries **no `confidence` and no `probabilities`**. For a binary question the probability is the confidence: 0.97 means "almost certainly yes", and 0.5 means genuine uncertainty. Threshold it when your code needs a hard decision.

`score` and `choice` may omit `instructions` if `criteria` alone is clear. A `noul` needs at least one of the two.

### Messages as input

LangChain messages are the common unit of context, so they are accepted anywhere in the input and converted automatically:

```ts
await classifier.invoke([new HumanMessage("..."), new AIMessage("...")]);
await classifier.invoke({ conversation: messages, account: { tier: "pro" } });
```

### Tracing

`TypeSafeClassifier` is a `Runnable`, so calls appear in LangSmith traces with their inputs, outputs and configuration, nested inside whatever agent or chain invoked them. The API key is redacted before it reaches the tracer. Note that LangSmith does not attribute token cost to non-LLM runs, so `usage` appears in the traced output rather than as a costed metric.

### Errors

```ts
import { TypeSafeRateLimitError } from "@langchain/typesafe";

try {
  await classifier.invoke(input);
} catch (error) {
  if (TypeSafeRateLimitError.isInstance(error)) {
    console.log(error.retryAfterMs, error.requestId);
  }
}
```

Use `.isInstance()` rather than `instanceof` — it stays correct when more than one copy of the library ends up in a dependency tree.

Errors carry `status`, `requestId`, `body` and `headers` as properties, but never render the response body into their message, because TypeSafe error bodies echo the request — including the content you asked it to classify.

Retries are handled by LangChain's `AsyncCaller`; configure them with `maxRetries` and `maxConcurrency` on the constructor.

## `@langchain/typesafe/middleware`

Two `createMiddleware`-based factories for use with LangChain agents.

`langchain` is an **optional** peer dependency — the base package does not
need it, so install it alongside if you use this entrypoint:

```bash
npm install @langchain/typesafe langchain
```

Without it, importing this entrypoint fails with
`Cannot find package 'langchain'`. The Python package raises a friendlier
`ImportError` here, but ESM cannot intercept a static import without making
these factories async, which is a worse trade.

### `modelRouterMiddleware`

Classifies the latest human message ONCE per agent run with a TypeSafe `Choice`, then routes every model call in that run to the selected model:

```ts
import { modelRouterMiddleware } from "@langchain/typesafe/middleware";
import { createAgent } from "langchain";

const agent = createAgent({
  model: "openai:gpt-5-mini",
  middleware: [
    modelRouterMiddleware({
      choices: {
        fast: {
          model: "openai:gpt-5-mini",
          criteria: "Simple, well-scoped tasks.",
        },
        powerful: {
          model: "openai:gpt-5",
          criteria: "Complex tasks requiring deeper reasoning.",
        },
      },
      instructions: "Choose the least costly model suited to the task.",
    }),
  ],
});
```

### `autoModeMiddleware`

Blocks a tool call before it runs when a TypeSafe `Noul` scores it above a risk threshold. It blocks rather than asking, and composes with `humanInTheLoopMiddleware` rather than replacing it:

```ts
import { autoModeMiddleware } from "@langchain/typesafe/middleware";
import { createAgent } from "langchain";

const agent = createAgent({
  model: "openai:gpt-5",
  tools: [runSqlTool, sendEmailTool],
  middleware: [
    autoModeMiddleware({
      tools: ["run_sql", "send_email"],
      threshold: 0.5, // default
    }),
  ],
});
```

Both middlewares build their own `TypeSafeClassifier` internally; pass `classifierOptions` (everything `TypeSafeClassifier` accepts except `questions`) to configure transport and model settings.

## Development

```bash
pnpm install
pnpm build --filter @langchain/typesafe
pnpm test
```

Integration tests hit the live API and are excluded from `pnpm test`. To run them, put your key in `libs/providers/langchain-typesafe/.env` (this path, not the repo root — `dotenv` resolves relative to the package directory):

```
TYPESAFE_API_KEY=your-key
```

then:

```bash
pnpm test:int
```

They skip rather than fail when no key is present.

## License

MIT
