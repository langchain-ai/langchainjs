# langchain

## 1.2.7

### Patch Changes

- [#9517](https://github.com/langchain-ai/langchainjs/pull/9517) [`23be5af`](https://github.com/langchain-ai/langchainjs/commit/23be5afd59b5f4806edef11937ce5e2ba300f7ee) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(langchain): Refactored agent generics to use type bag pattern (AgentTypeConfig, MiddlewareTypeConfig) with new helper types for type extraction.

- [#9761](https://github.com/langchain-ai/langchainjs/pull/9761) [`e0360d9`](https://github.com/langchain-ai/langchainjs/commit/e0360d9bdc0e7725d59625902bcfc98c39931e2a) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(langchain): ensure models only make on write_todo call at a time

- Updated dependencies [[`23be5af`](https://github.com/langchain-ai/langchainjs/commit/23be5afd59b5f4806edef11937ce5e2ba300f7ee)]:
  - @langchain/core@1.1.12

## 1.2.6

### Patch Changes

- Updated dependencies [[`a46a249`](https://github.com/langchain-ai/langchainjs/commit/a46a24983fd0fea649d950725a2673b3c435275f)]:
  - @langchain/core@1.1.11

## 1.2.5

### Patch Changes

- Updated dependencies [[`817fc9a`](https://github.com/langchain-ai/langchainjs/commit/817fc9a56d4699f3563a6e153b13eadf7bcc661b)]:
  - @langchain/core@1.1.10

## 1.2.4

### Patch Changes

- [#9739](https://github.com/langchain-ai/langchainjs/pull/9739) [`c28d24a`](https://github.com/langchain-ai/langchainjs/commit/c28d24a8770f6d0e543cde116b0e38b3baf21301) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(core): use getBufferString for message summarization

- [#9729](https://github.com/langchain-ai/langchainjs/pull/9729) [`536c7dd`](https://github.com/langchain-ai/langchainjs/commit/536c7ddacd6c7f80d2edf18ab9caeeab71827ccd) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(langchain): default strict to true in providerStrategy for OpenAI compatibility

- [#9728](https://github.com/langchain-ai/langchainjs/pull/9728) [`5cfbedf`](https://github.com/langchain-ai/langchainjs/commit/5cfbedf064ffdc960cb2e5a97e37d7a5900560de) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(langchain): support callbacks property in stream

- [#9715](https://github.com/langchain-ai/langchainjs/pull/9715) [`cc502e1`](https://github.com/langchain-ai/langchainjs/commit/cc502e1b67dbadcd123a7ea2964c791c2bbad581) Thanks [@jacoblee93](https://github.com/jacoblee93)! - fix(langchain): Add secretsFromEnv and secrets for prompt pulling
  fix(@langchain/classic): Add secretsFromEnv and secrets for prompt pulling

- [#9703](https://github.com/langchain-ai/langchainjs/pull/9703) [`5d1b874`](https://github.com/langchain-ai/langchainjs/commit/5d1b874e1bb0a038f23576d5ff6d8335b755bce1) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(langchain): properly pass on schema title

- [#9702](https://github.com/langchain-ai/langchainjs/pull/9702) [`bfcb87d`](https://github.com/langchain-ai/langchainjs/commit/bfcb87d23c580c7881f650960a448fe2e54a30b3) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(core): improve interop with Zod

- [#9714](https://github.com/langchain-ai/langchainjs/pull/9714) [`42b138f`](https://github.com/langchain-ai/langchainjs/commit/42b138fe20a8d711938058a69669e1c29b18bd50) Thanks [@r77wu](https://github.com/r77wu)! - use parseJumpToTarget in 'afterModel' Router

- [#9740](https://github.com/langchain-ai/langchainjs/pull/9740) [`f697451`](https://github.com/langchain-ai/langchainjs/commit/f6974516b041ed12befd26e1a4cbe457865a2780) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(langchain): keep tool call / AIMessage pairings when summarizing

- Updated dependencies [[`56600b9`](https://github.com/langchain-ai/langchainjs/commit/56600b94f8e185f44d4288b7a9b66c55778938dd), [`dc5c2ac`](https://github.com/langchain-ai/langchainjs/commit/dc5c2ac00f86dd2feeba9843d708926a5f38202e), [`c28d24a`](https://github.com/langchain-ai/langchainjs/commit/c28d24a8770f6d0e543cde116b0e38b3baf21301), [`bfcb87d`](https://github.com/langchain-ai/langchainjs/commit/bfcb87d23c580c7881f650960a448fe2e54a30b3)]:
  - @langchain/core@1.1.9

## 1.2.3

### Patch Changes

- [#9707](https://github.com/langchain-ai/langchainjs/pull/9707) [`e5063f9`](https://github.com/langchain-ai/langchainjs/commit/e5063f9c6e9989ea067dfdff39262b9e7b6aba62) Thanks [@hntrl](https://github.com/hntrl)! - add security hardening for `load`

- Updated dependencies [[`e5063f9`](https://github.com/langchain-ai/langchainjs/commit/e5063f9c6e9989ea067dfdff39262b9e7b6aba62), [`8996647`](https://github.com/langchain-ai/langchainjs/commit/89966470e8c0b112ce4f9a326004af6a4173f9e6)]:
  - @langchain/core@1.1.8

## 1.2.2

### Patch Changes

- [#9675](https://github.com/langchain-ai/langchainjs/pull/9675) [`af664be`](https://github.com/langchain-ai/langchainjs/commit/af664becc0245b2315ea2f784c9a6c1d7622dbb4) Thanks [@jacoblee93](https://github.com/jacoblee93)! - Bump LangSmith dep to 0.4.0

- [#9673](https://github.com/langchain-ai/langchainjs/pull/9673) [`ffb2402`](https://github.com/langchain-ai/langchainjs/commit/ffb24026cd93e58219519ee24c6e23ea57cb5bde) Thanks [@hntrl](https://github.com/hntrl)! - add `context` utility

- Updated dependencies [[`df9c42b`](https://github.com/langchain-ai/langchainjs/commit/df9c42b3ab61b85309ab47256e1d93c3188435ee), [`8d2982b`](https://github.com/langchain-ai/langchainjs/commit/8d2982bb94c0f4e4314ace3cc98a1ae87571b1ed), [`af664be`](https://github.com/langchain-ai/langchainjs/commit/af664becc0245b2315ea2f784c9a6c1d7622dbb4), [`ffb2402`](https://github.com/langchain-ai/langchainjs/commit/ffb24026cd93e58219519ee24c6e23ea57cb5bde)]:
  - @langchain/core@1.1.7

## 1.2.1

### Patch Changes

- Updated dependencies [[`a7b2a7d`](https://github.com/langchain-ai/langchainjs/commit/a7b2a7db5ef57df3731ae6c9931f4b663e909505), [`a496c5f`](https://github.com/langchain-ai/langchainjs/commit/a496c5fc64d94cc0809216325b0f1bfde3f92c45), [`1da1325`](https://github.com/langchain-ai/langchainjs/commit/1da1325aea044fb37af54a9de1f4ae0b9f47d4a2)]:
  - @langchain/core@1.1.6

## 1.2.0

### Minor Changes

- [#9651](https://github.com/langchain-ai/langchainjs/pull/9651) [`348c37c`](https://github.com/langchain-ai/langchainjs/commit/348c37c01a048c815fea1827c084878744e20742) Thanks [@christian-bromann](https://github.com/christian-bromann)! - feat(langchain): allow to set strict tag manually in providerStrategy #9578

## 1.1.6

### Patch Changes

- [#9586](https://github.com/langchain-ai/langchainjs/pull/9586) [`bc8e90f`](https://github.com/langchain-ai/langchainjs/commit/bc8e90f4f77d71f739c8faf3e6c22ab7e54ffc3c) Thanks [@hntrl](https://github.com/hntrl)! - patch prompts created from runs fix

- [#9623](https://github.com/langchain-ai/langchainjs/pull/9623) [`ade8b8a`](https://github.com/langchain-ai/langchainjs/commit/ade8b8af0b32a9afd5c5a0bf6c4543d3cb7fd848) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(langchain): properly retrieve structured output from thinking block

- [#9637](https://github.com/langchain-ai/langchainjs/pull/9637) [`88bb788`](https://github.com/langchain-ai/langchainjs/commit/88bb7882fadf185bad927277810c682c2eee8d01) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(langchain): Prevent functions from being accidentally assignable to AgentMiddleware

- [#8964](https://github.com/langchain-ai/langchainjs/pull/8964) [`38ff1b5`](https://github.com/langchain-ai/langchainjs/commit/38ff1b55d353196b8af7f64f7b854b8f643e3de9) Thanks [@jnjacobson](https://github.com/jnjacobson)! - add support for anyOf, allOf, oneOf in openapi conversion

- [#9640](https://github.com/langchain-ai/langchainjs/pull/9640) [`aa8c4f8`](https://github.com/langchain-ai/langchainjs/commit/aa8c4f867abe79b1c6de09a7b51a69163d0972aa) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(langchain): prevent summarization middleware from leaking streaming events

- [#9648](https://github.com/langchain-ai/langchainjs/pull/9648) [`29a8480`](https://github.com/langchain-ai/langchainjs/commit/29a8480799d4c3534892a29cef4a135c437deb9b) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(langchain): allow to set strict tag manually in providerStrategy #9578

- [#9630](https://github.com/langchain-ai/langchainjs/pull/9630) [`a2df2d4`](https://github.com/langchain-ai/langchainjs/commit/a2df2d422e040485da61120bbbda6ced543e578b) Thanks [@nephix](https://github.com/nephix)! - fix(summary-middleware): use summaryPrefix or fall back to default prefix

- Updated dependencies [[`005c729`](https://github.com/langchain-ai/langchainjs/commit/005c72903bcdf090e0f4c58960c8c243481f9874), [`ab78246`](https://github.com/langchain-ai/langchainjs/commit/ab782462753e6c3ae5d55c0c251f795af32929d5), [`8cc81c7`](https://github.com/langchain-ai/langchainjs/commit/8cc81c7cee69530f7a6296c69123edbe227b2fce), [`f32e499`](https://github.com/langchain-ai/langchainjs/commit/f32e4991d0e707324e3f6af287a1ee87ab833b7e), [`a28d83d`](https://github.com/langchain-ai/langchainjs/commit/a28d83d49dd1fd31e67b52a44abc70f2cc2a2026), [`2e5ad70`](https://github.com/langchain-ai/langchainjs/commit/2e5ad70d16c1f13eaaea95336bbe2ec4a4a4954a), [`e456c66`](https://github.com/langchain-ai/langchainjs/commit/e456c661aa1ab8f1ed4a98c40616f5a13270e88e), [`1cfe603`](https://github.com/langchain-ai/langchainjs/commit/1cfe603e97d8711343ae5f1f5a75648e7bd2a16e)]:
  - @langchain/core@1.1.5

## 1.1.5

### Patch Changes

- Updated dependencies [[`0bade90`](https://github.com/langchain-ai/langchainjs/commit/0bade90ed47c7988ed86f1e695a28273c7b3df50), [`6c40d00`](https://github.com/langchain-ai/langchainjs/commit/6c40d00e926f377d249c2919549381522eac8ed1)]:
  - @langchain/core@1.1.4

## 1.1.4

### Patch Changes

- Updated dependencies [[`bd2c46e`](https://github.com/langchain-ai/langchainjs/commit/bd2c46e09e661d9ac766c09e71bc6687d6fc811c), [`487378b`](https://github.com/langchain-ai/langchainjs/commit/487378bf14277659c8ca0ef06ea0f9836b818ff4), [`138e7fb`](https://github.com/langchain-ai/langchainjs/commit/138e7fb6280705457079863bedb238b16b322032)]:
  - @langchain/core@1.1.3

## 1.1.3

### Patch Changes

- [#9532](https://github.com/langchain-ai/langchainjs/pull/9532) [`3424293`](https://github.com/langchain-ai/langchainjs/commit/34242933ade61304481d055605af06ec54c8f5e4) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(langchain): improve state rendering in LangSmith studio

- [#9529](https://github.com/langchain-ai/langchainjs/pull/9529) [`0d2f74a`](https://github.com/langchain-ai/langchainjs/commit/0d2f74aeef2c05ddcf74dc6286bfa8eabf785ed2) Thanks [@christian-bromann](https://github.com/christian-bromann)! - fix(langchain): better detect invoke response in agent node

- [#9523](https://github.com/langchain-ai/langchainjs/pull/9523) [`95a8f78`](https://github.com/langchain-ai/langchainjs/commit/95a8f78179b38b69419079c7b9315844f49aab0c) Thanks [@LiteracyFanatic](https://github.com/LiteracyFanatic)! - Fix detection of models with native support for structured output

- Updated dependencies [[`833f578`](https://github.com/langchain-ai/langchainjs/commit/833f57834dc3aa64e4cfdd7499f865b2ab41462a)]:
  - @langchain/core@1.1.2

## 1.1.2

### Patch Changes

- Updated dependencies [[`636b994`](https://github.com/langchain-ai/langchainjs/commit/636b99459bf843362298866211c63a7a15c2a319), [`38f0162`](https://github.com/langchain-ai/langchainjs/commit/38f0162b7b2db2be2c3a75ae468728adcb49fdfb)]:
  - @langchain/core@1.1.1

## 1.1.1

### Patch Changes

- [#9487](https://github.com/langchain-ai/langchainjs/pull/9487) [`4827945`](https://github.com/langchain-ai/langchainjs/commit/48279457ee44f36cdde175a537e2b12f5866627f) Thanks [@hntrl](https://github.com/hntrl)! - constrain lower bound core peer dep

## 1.1.0

### Minor Changes

- [#9476](https://github.com/langchain-ai/langchainjs/pull/9476) [`2a47c77`](https://github.com/langchain-ai/langchainjs/commit/2a47c77c29a873c4c4d4940458e0d5fb3b2e45ce) Thanks [@christian-bromann](https://github.com/christian-bromann)! - add new modelRetryMiddleware

- [#9475](https://github.com/langchain-ai/langchainjs/pull/9475) [`708d360`](https://github.com/langchain-ai/langchainjs/commit/708d360df1869def7e4caaa5995d6e907bbf54cd) Thanks [@christian-bromann](https://github.com/christian-bromann)! - Support `SystemMessage` as `systemPrompt`

- [#9475](https://github.com/langchain-ai/langchainjs/pull/9475) [`708d360`](https://github.com/langchain-ai/langchainjs/commit/708d360df1869def7e4caaa5995d6e907bbf54cd) Thanks [@christian-bromann](https://github.com/christian-bromann)! - Add OpenAI content moderation middleware

### Patch Changes

- [#9467](https://github.com/langchain-ai/langchainjs/pull/9467) [`2750e08`](https://github.com/langchain-ai/langchainjs/commit/2750e08547614de366019584940fdb1ba93e581c) Thanks [@hntrl](https://github.com/hntrl)! - allow overriding profiles in `initChatModel`

- [#9467](https://github.com/langchain-ai/langchainjs/pull/9467) [`2750e08`](https://github.com/langchain-ai/langchainjs/commit/2750e08547614de366019584940fdb1ba93e581c) Thanks [@hntrl](https://github.com/hntrl)! - cache model instance imports for `initChatModel`

- [#9416](https://github.com/langchain-ai/langchainjs/pull/9416) [`0fe9beb`](https://github.com/langchain-ai/langchainjs/commit/0fe9bebee6710f719e47f913eec1ec4f638e4de4) Thanks [@hntrl](https://github.com/hntrl)! - fix 'moduleResultion: "node"' compatibility

- [#9467](https://github.com/langchain-ai/langchainjs/pull/9467) [`2750e08`](https://github.com/langchain-ai/langchainjs/commit/2750e08547614de366019584940fdb1ba93e581c) Thanks [@hntrl](https://github.com/hntrl)! - pass model profiles from chat models in `initChatModel`

## 1.0.6

### Patch Changes

- [#9434](https://github.com/langchain-ai/langchainjs/pull/9434) [`f7cfece`](https://github.com/langchain-ai/langchainjs/commit/f7cfecec29bf0f121e1a8b0baface5327d731122) Thanks [@deepansh946](https://github.com/deepansh946)! - Updated error handling behaviour of AgentNode

## 1.0.5

### Patch Changes

- [#9403](https://github.com/langchain-ai/langchainjs/pull/9403) [`944bf56`](https://github.com/langchain-ai/langchainjs/commit/944bf56ff0926e102c56a3073bfde6b751c97794) Thanks [@christian-bromann](https://github.com/christian-bromann)! - improvements to toolEmulator middleware

- [#9388](https://github.com/langchain-ai/langchainjs/pull/9388) [`831168a`](https://github.com/langchain-ai/langchainjs/commit/831168a5450bff706a319842626214281204346d) Thanks [@hntrl](https://github.com/hntrl)! - use `profile.maxInputTokens` in summarization middleware

- [#9393](https://github.com/langchain-ai/langchainjs/pull/9393) [`f1e2f9e`](https://github.com/langchain-ai/langchainjs/commit/f1e2f9eeb365bae78c8b5991ed41bfed58f25da6) Thanks [@christian-bromann](https://github.com/christian-bromann)! - align context editing with summarization interface

- [#9427](https://github.com/langchain-ai/langchainjs/pull/9427) [`bad7aea`](https://github.com/langchain-ai/langchainjs/commit/bad7aea86d3f60616952104c34a33de9561867c7) Thanks [@dqbd](https://github.com/dqbd)! - fix(langchain): add tool call contents and tool call ID to improve token count approximation

- [#9396](https://github.com/langchain-ai/langchainjs/pull/9396) [`ed6b581`](https://github.com/langchain-ai/langchainjs/commit/ed6b581e525cdf5d3b29abb1e17ca6169554c1b5) Thanks [@christian-bromann](https://github.com/christian-bromann)! - rename exit behavior from throw to error

## 1.0.4

### Patch Changes

- b401680: avoid invalid message order after summarization
- f63fc0f: fix(langchain): export ToolRuntime from langchain

## 1.0.3

### Patch Changes

- f1583cd: allow for model strings in summarization middleware
- e960f97: check message property when pulling chat models for vercel compat
- 66fc10c: fix(langchain): don't allow default or optional context schemas
- 0a8a23b: feat(@langchain/core): support of ToolRuntime
- b38be50: Add missing ToolMessage in toolStrategy structured output
- 42930b5: fix(langchain): improved state schema typing

## 1.0.2

### Patch Changes

- 2e45c43: fix(langchain): remove bad dynamic import for LS
- 28eceac: preserve full model name when deciding model provider

## 1.0.0

🎉 **LangChain v1.0** is here! This release provides a focused, production-ready foundation for building agents. We've streamlined the framework around three core improvements: **`createAgent`**, **standard content blocks**, and a **simplified package structure**. See the [release notes](https://docs.langchain.com/oss/javascript/releases/langchain-v1) for complete details.

### ✨ Major Features

#### `createAgent` - A new standard for building agents

`createAgent` is the new standard way to build agents in LangChain 1.0. It provides a simpler interface than `createReactAgent` from LangGraph while offering greater customization potential through middleware.

**Key features:**

- **Clean, intuitive API**: Build agents with minimal boilerplate
- **Built on LangGraph**: Get persistence, streaming, human-in-the-loop, and time travel out of the box
- **Middleware-first design**: Highly customizable through composable middleware
- **Improved structured output**: Generate structured outputs in the main agent loop without additional LLM calls

Example:

```typescript
import { createAgent } from "langchain";

const agent = createAgent({
  model: "anthropic:claude-sonnet-4-5-20250929",
  tools: [getWeather],
  systemPrompt: "You are a helpful assistant.",
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "What is the weather in Tokyo?" }],
});

console.log(result.content);
```

Under the hood, `createAgent` is built on the basic agent loop—calling a model using LangGraph, letting it choose tools to execute, and then finishing when it calls no more tools.

**Built on LangGraph features (work out of the box):**

- **Persistence**: Conversations automatically persist across sessions with built-in checkpointing
- **Streaming**: Stream tokens, tool calls, and reasoning traces in real-time
- **Human-in-the-loop**: Pause agent execution for human approval before sensitive actions
- **Time travel**: Rewind conversations to any point and explore alternate paths

**Structured output improvements:**

- Generate structured outputs in the main loop instead of requiring an additional LLM call
- Models can choose between calling tools or using provider-side structured output generation
- Significant cost reduction by eliminating extra LLM calls

Example:

```typescript
import { createAgent } from "langchain";
import * as z from "zod";

const weatherSchema = z.object({
  temperature: z.number(),
  condition: z.string(),
});

const agent = createAgent({
  model: "openai:gpt-4o-mini",
  tools: [getWeather],
  responseFormat: weatherSchema,
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "What is the weather in Tokyo?" }],
});

console.log(result.structuredResponse);
```

For more information, see [Agents documentation](https://docs.langchain.com/oss/javascript/langchain/agents).

#### Middleware

Middleware is what makes `createAgent` highly customizable, raising the ceiling for what you can build. Great agents require **context engineering**—getting the right information to the model at the right time. Middleware helps you control dynamic prompts, conversation summarization, selective tool access, state management, and guardrails through a composable abstraction.

**Prebuilt middleware** for common patterns:

```typescript
import {
  createAgent,
  summarizationMiddleware,
  humanInTheLoopMiddleware,
  piiRedactionMiddleware,
} from "langchain";

const agent = createAgent({
  model: "anthropic:claude-sonnet-4-5-20250929",
  tools: [readEmail, sendEmail],
  middleware: [
    piiRedactionMiddleware({ patterns: ["email", "phone", "ssn"] }),
    summarizationMiddleware({
      model: "anthropic:claude-sonnet-4-5-20250929",
      maxTokensBeforeSummary: 500,
    }),
    humanInTheLoopMiddleware({
      interruptOn: {
        sendEmail: {
          allowedDecisions: ["approve", "edit", "reject"],
        },
      },
    }),
  ] as const,
});
```

**Custom middleware** with lifecycle hooks:

| Hook            | When it runs             | Use cases                               |
| --------------- | ------------------------ | --------------------------------------- |
| `beforeAgent`   | Before calling the agent | Load memory, validate input             |
| `beforeModel`   | Before each LLM call     | Update prompts, trim messages           |
| `wrapModelCall` | Around each LLM call     | Intercept and modify requests/responses |
| `wrapToolCall`  | Around each tool call    | Intercept and modify tool execution     |
| `afterModel`    | After each LLM response  | Validate output, apply guardrails       |
| `afterAgent`    | After agent completes    | Save results, cleanup                   |

Example custom middleware:

```typescript
import { createMiddleware } from "langchain";

const contextSchema = z.object({
  userExpertise: z.enum(["beginner", "expert"]).default("beginner"),
});

const expertiseBasedToolMiddleware = createMiddleware({
  wrapModelCall: async (request, handler) => {
    const userLevel = request.runtime.context.userExpertise;
    if (userLevel === "expert") {
      const tools = [advancedSearch, dataAnalysis];
      return handler(request.replace("openai:gpt-5", tools));
    }
    const tools = [simpleSearch, basicCalculator];
    return handler(request.replace("openai:gpt-5-nano", tools));
  },
});

const agent = createAgent({
  model: "anthropic:claude-sonnet-4-5-20250929",
  tools: [simpleSearch, advancedSearch, basicCalculator, dataAnalysis],
  middleware: [expertiseBasedToolMiddleware],
  contextSchema,
});
```

For more information, see the [complete middleware guide](https://docs.langchain.com/oss/javascript/langchain/middleware).

#### Simplified Package

LangChain v1 streamlines the `langchain` package namespace to focus on essential building blocks for agents. The package exposes only the most useful and relevant functionality (most re-exported from `@langchain/core` for convenience).

**What's in the core `langchain` package:**

- `createAgent` and agent-related utilities
- Core message types and content blocks
- Middleware infrastructure
- Tool definitions and schemas
- Prompt templates
- Output parsers
- Base runnable abstractions

### 🔄 Migration Notes

#### `@langchain/classic` for Legacy Functionality

Legacy functionality has moved to [`@langchain/classic`](https://www.npmjs.com/package/@langchain/classic) to keep the core package lean and focused.

**What's in `@langchain/classic`:**

- Legacy chains and chain implementations
- The indexing API
- [`@langchain/community`](https://www.npmjs.com/package/@langchain/community) exports
- Other deprecated functionality

**To migrate legacy code:**

1. Install `@langchain/classic`:

   ```bash
   npm install @langchain/classic
   ```

2. Update your imports:

   ```typescript
   import { ... } from "langchain"; // [!code --]
   import { ... } from "@langchain/classic"; // [!code ++]

   import { ... } from "langchain/chains"; // [!code --]
   import { ... } from "@langchain/classic/chains"; // [!code ++]
   ```

#### Upgrading to v1

Install the v1 packages:

```bash
npm install langchain@1.0.0 @langchain/core@1.0.0
```

### 📚 Additional Resources

- [LangChain 1.0 Announcement](https://blog.langchain.com/langchain-langchain-1-0-alpha-releases/)
- [Migration Guide](https://docs.langchain.com/oss/javascript/migrate/langchain-v1)
- [Agents Documentation](https://docs.langchain.com/oss/javascript/langchain/agents)
- [Middleware Guide](https://blog.langchain.com/agent-middleware/)

---

## 0.3.36

### Patch Changes

- cabd762: fix(langchain): add ChatMistralAI to well known models
- Updated dependencies [e63c7cc]
- Updated dependencies [b8ffc1e]
  - @langchain/openai@0.6.16

## 0.3.35

### Patch Changes

- fd4691f: use `keyEncoder` instead of insecure cache key getter
- 2f19cd5: feat: Add Perplexity support to universal chat model
- 3c94076: fix(langchain): Bind schemas for other types of pulled hub prompts
- Updated dependencies [d38e9d6]
  - @langchain/openai@0.6.14

## 0.3.34

### Patch Changes

- 6019a7d: update JSONL loader to support complex json structures
- caf5579: prevent ConfigurableModel mutation when using withStructuredOutput or bindTools
- d60f40f: infer mistralai models
- Updated dependencies [41bd944]
- Updated dependencies [707a768]
  - @langchain/openai@0.6.12

## 0.3.33

### Patch Changes

- d2c7f09: support prompts not created from RunnableBinding

## 0.3.32

### Patch Changes

- e0bd88c: add support for conversion of ref in array schema
- Updated dependencies [4a3f5af]
- Updated dependencies [424360b]
  - @langchain/openai@0.6.10
