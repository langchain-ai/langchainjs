# OpenAI

This guide goes through how to use the OpenAI LLM wrapper.

```typescript
import { OpenAI } from "langchain/llms";

const model = new OpenAI({ temperature: 0.9 });
const res = await model.call(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
```

## PromptLayer OpenAI

This library supports PromptLayer for logging and debugging prompts and responses. To add support for PromptLayer:

1. Create a PromptLayer account here: [https://promptlayer.com](https://promptlayer.com).
2. Create an API token and pass it either as `promptLayerApiKey` argument in the `PromptLayerOpenAI` constructor or in the `PROMPT_LAYER_API_KEY` environment variable.

```typescript
const model = new PromptLayerOpenAI({ temperature: 0.9 });
const res = await model.call(
  "What would be a good company name a company that makes colorful socks?"
);
```

The request and the response will be logged in the [PromptLayer dashboard](https://promptlayer.com/home).

Note: In streaming mode PromptLayer will not log the response.
