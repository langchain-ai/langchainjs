---
sidebar_position: 3
sidebar_label: Integrations
---

import CodeBlock from "@theme/CodeBlock";

# Integrations: LLMs

LangChain offers a number of LLM implementations that integrate with various model providers. These are:

## `OpenAI`

```typescript
import { OpenAI } from "langchain/llms/openai";

const model = new OpenAI({
  temperature: 0.9,
  openAIApiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.OPENAI_API_KEY
});
const res = await model.call(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
```

## Azure `OpenAI`

```typescript
import { OpenAI } from "langchain/llms/openai";

const model = new OpenAI({
  temperature: 0.9,
  azureOpenAIApiKey: "YOUR-API-KEY",
  azureOpenAIApiInstanceName: "YOUR-INSTANCE-NAME",
  azureOpenAIApiDeploymentName: "YOUR-DEPLOYMENT-NAME",
  azureOpenAIApiVersion: "YOUR-API-VERSION",
});
const res = await model.call(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
```

## Google Vertex AI

The Vertex AI implementation is meant to be used in Node.js and not
directly in a browser, since it requires a service account to use.

Before running this code, you should make sure the Vertex AI API is
enabled for the relevant project in your Google Cloud dashboard and that you've authenticated to
Google Cloud using one of these methods:

- You are logged into an account (using `gcloud auth application-default login`)
  permitted to that project.
- You are running on a machine using a service account that is permitted
  to the project.
- You have downloaded the credentials for a service account that is permitted
  to the project and set the `GOOGLE_APPLICATION_CREDENTIALS` environment
  variable to the path of this file.

```bash npm2yarn
npm install google-auth-library
```

import GoogleVertexAIExample from "@examples/llms/googlevertexai.ts";

<CodeBlock language="typescript">{GoogleVertexAIExample}</CodeBlock>

## `HuggingFaceInference`

```bash npm2yarn
npm install @huggingface/inference@1
```

```typescript
import { HuggingFaceInference } from "langchain/llms/hf";

const model = new HuggingFaceInference({
  model: "gpt2",
  apiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.HUGGINGFACEHUB_API_KEY
});
const res = await model.call("1 + 1 =");
console.log({ res });
```

## `Cohere`

```bash npm2yarn
npm install cohere-ai
```

```typescript
import { Cohere } from "langchain/llms/cohere";

const model = new Cohere({
  maxTokens: 20,
  apiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.COHERE_API_KEY
});
const res = await model.call(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
```

## `Replicate`

```bash npm2yarn
npm install replicate
```

```typescript
import { Replicate } from "langchain/llms/replicate";

const model = new Replicate({
  model:
    "daanelson/flan-t5:04e422a9b85baed86a4f24981d7f9953e20c5fd82f6103b74ebc431588e1cec8",
  apiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.REPLICATE_API_KEY
});
const res = await modelA.call(
  "What would be a good company name a company that makes colorful socks?"
);
console.log({ res });
```

## AWS `SageMakerEndpoint`

Check [Amazon SageMaker JumpStart](https://aws.amazon.com/sagemaker/jumpstart/) for a list of available models, and how to deploy your own.

```bash npm2yarn
npm install @aws-sdk/client-sagemaker-runtime
```

import SageMakerEndpointExample from "@examples/models/llm/sagemaker_endpoint.ts";

<CodeBlock language="typescript">{SageMakerEndpointExample}</CodeBlock>

## Additional LLM Implementations

### `PromptLayerOpenAI`

LangChain integrates with PromptLayer for logging and debugging prompts and responses. To add support for PromptLayer:

1. Create a PromptLayer account here: [https://promptlayer.com](https://promptlayer.com).
2. Create an API token and pass it either as `promptLayerApiKey` argument in the `PromptLayerOpenAI` constructor or in the `PROMPTLAYER_API_KEY` environment variable.

```typescript
import { PromptLayerOpenAI } from "langchain/llms/openai";

const model = new PromptLayerOpenAI({
  temperature: 0.9,
  openAIApiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.OPENAI_API_KEY
  promptLayerApiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.PROMPTLAYER_API_KEY
});
const res = await model.call(
  "What would be a good company name a company that makes colorful socks?"
);
```

### Azure `PromptLayerOpenAI`

LangChain integrates with PromptLayer for logging and debugging prompts and responses. To add support for PromptLayer:

1. Create a PromptLayer account here: [https://promptlayer.com](https://promptlayer.com).
2. Create an API token and pass it either as `promptLayerApiKey` argument in the `PromptLayerOpenAI` constructor or in the `PROMPTLAYER_API_KEY` environment variable.

```typescript
import { PromptLayerOpenAI } from "langchain/llms/openai";

const model = new PromptLayerOpenAI({
  temperature: 0.9,
  azureOpenAIApiKey: "YOUR-AOAI-API-KEY", // In Node.js defaults to process.env.AZURE_OPENAI_API_KEY
  azureOpenAIApiInstanceName: "YOUR-AOAI-INSTANCE-NAME", // In Node.js defaults to process.env.AZURE_OPENAI_API_INSTANCE_NAME
  azureOpenAIApiDeploymentName: "YOUR-AOAI-DEPLOYMENT-NAME", // In Node.js defaults to process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME
  azureOpenAIApiCompletionsDeploymentName:
    "YOUR-AOAI-COMPLETIONS-DEPLOYMENT-NAME", // In Node.js defaults to process.env.AZURE_OPENAI_API_COMPLETIONS_DEPLOYMENT_NAME
  azureOpenAIApiEmbeddingsDeploymentName:
    "YOUR-AOAI-EMBEDDINGS-DEPLOYMENT-NAME", // In Node.js defaults to process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME
  azureOpenAIApiVersion: "YOUR-AOAI-API-VERSION", // In Node.js defaults to process.env.AZURE_OPENAI_API_VERSION
  promptLayerApiKey: "YOUR-API-KEY", // In Node.js defaults to process.env.PROMPTLAYER_API_KEY
});
const res = await model.call(
  "What would be a good company name a company that makes colorful socks?"
);
```

The request and the response will be logged in the [PromptLayer dashboard](https://promptlayer.com/home).

> **_Note:_** In streaming mode PromptLayer will not log the response.
