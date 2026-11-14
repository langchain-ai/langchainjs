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
  "overrides": { "@langchain/core": "^1.4.0" },
  "resolutions": { "@langchain/core": "^1.4.0" },
  "pnpm": { "overrides": { "@langchain/core": "^1.4.0" } }
}
```

## Usage

Set `TYPESAFE_API_KEY` in your environment, then:

```ts
import { TypeSafeClassifier } from "@langchain/typesafe";

const classifier = new TypeSafeClassifier();

const result = await classifier.invoke({
  state: {
    message: "Help! My payouts have been failing for 3 days.",
    account_tier: "enterprise",
  },
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

result.answers.department; // { type: "choice", choice: "billing", confidence: 0.99, probabilities: {...} }
result.answers.urgent; // { type: "noul", noul: 0.97 }
result.answers.frustration; // { type: "score", score: 1.3, legend: { 0: "calm", ... }, ... }
```

`TypeSafeClassifier` is a LangChain decision model (`BaseDecisionModel` from `@langchain/core/decisions`), so questions are sent with each request and the question and answer types are the shared ones from core.

`result.model` is the versioned model that actually answered (e.g. `jev-1.13.0`), not the alias you sent — `jev-latest` in, `jev-1.13.0` out.

Four read-only, non-enumerable helpers partition `answers` by variant, keyed by question id — handy when you only care about one kind of question:

```ts
result.choices.department; // same object as result.answers.department
result.nouls.urgent;
result.scores.frustration;
result.boxes.dog;
```

Because they're non-enumerable, they never duplicate `answers` in `JSON.stringify(result)` or a LangSmith trace.

### Question types

| Type     | Ask                                         | Get back                                                                                     |
| -------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `choice` | pick one of N labels you define             | the winning label, the full distribution, and a confidence                                   |
| `score`  | position on an ordered rubric (low to high) | a probability-weighted number that may land _between_ levels, plus a legend and distribution |
| `noul`   | a single yes/no proposition                 | a bare probability from 0 to 1                                                               |
| `box`    | where something is in an image              | the box's edges as fractions of the image height and width                                   |

A Noul answer carries **no `confidence` and no `probabilities`**. For a binary question the probability is the confidence: 0.97 means "almost certainly yes", and 0.5 means genuine uncertainty. Threshold it when your code needs a hard decision.

Every question requires `instructions`.

### Messages as input

LangChain messages are the common unit of context, so they are accepted anywhere in the input and converted automatically:

```ts
await classifier.invoke({
  state: [new HumanMessage("..."), new AIMessage("...")],
  questions,
});
await classifier.invoke({
  state: { conversation: messages, account: { tier: "pro" } },
  questions,
});
```

### Images

Image content blocks with inline base64 data or a base64 `data:` URL can appear anywhere in `state` or in question `instructions` and `criteria`, including inside messages. They are sent to TypeSafe as request assets. PNG and JPEG images are supported; images are not downloaded from remote URLs.

```ts
const result = await classifier.invoke({
  state: { type: "image", data: imageData, mimeType: "image/png" },
  questions: { dog: { type: "box", instructions: "Where is the dog?" } },
});
result.boxes.dog.box; // { top, bottom, left, right }
```

### Tracing

Calls appear in LangSmith as LLM runs with `ls_provider: "typesafe"` and the model name, nested inside whatever agent or chain invoked them. Token usage is reported as `usage_metadata` in the run output. The API key is redacted before it reaches the tracer.

### Errors

```ts
import { TypeSafeRateLimitError } from "@langchain/typesafe";

try {
  await classifier.invoke(request);
} catch (error) {
  if (TypeSafeRateLimitError.isInstance(error)) {
    console.log(error.retryAfterMs, error.requestId);
  }
}
```

Use `.isInstance()` rather than `instanceof` — it stays correct when more than one copy of the library ends up in a dependency tree.

Errors carry `status`, `requestId`, `body` and `headers` as properties, but never render the response body into their message, because TypeSafe error bodies echo the request — including the content you asked it to classify.

Retries are handled by LangChain's `AsyncCaller`; configure them with `maxRetries` and `maxConcurrency` on the constructor.

## Agent middleware

LangChain's `modelRouterMiddleware` and `autoModeMiddleware` accept any decision model as their `classifier`. Pass a `TypeSafeClassifier` to use TypeSafe.

> **Deprecated:** `@langchain/typesafe/middleware` is deprecated since 0.1.0 and will be removed in 0.2.0. Import the middleware from `langchain` and pass `classifier: new TypeSafeClassifier()` instead.

### `modelRouterMiddleware`

Classifies the latest human message once per agent run with a `Choice` question, then routes every model call in that run to the selected model:

```ts
import { createAgent, modelRouterMiddleware } from "langchain";
import { TypeSafeClassifier } from "@langchain/typesafe";

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
      classifier: new TypeSafeClassifier(),
    }),
  ],
});
```

### `autoModeMiddleware`

Classifies calls to explicitly configured tools and blocks risky calls before they run. It blocks rather than asking, and composes with `humanInTheLoopMiddleware` rather than replacing it:

```ts
import { autoModeMiddleware, createAgent } from "langchain";
import { TypeSafeClassifier } from "@langchain/typesafe";

const agent = createAgent({
  model: "openai:gpt-5",
  tools: [runSqlTool, sendEmailTool],
  middleware: [
    autoModeMiddleware({
      tools: [runSqlTool, sendEmailTool],
      criteria: {
        true: "The call writes, deletes, publishes, or changes access.",
        false: "The call only reads public or user-provided data.",
      },
      classifier: new TypeSafeClassifier(),
    }),
  ],
});
```

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
