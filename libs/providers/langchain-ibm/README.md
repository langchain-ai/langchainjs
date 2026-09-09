# @langchain/ibm

This package contains the LangChain.js integrations for [IBM watsonx.ai](https://www.ibm.com/watsonx) via the `@ibm-cloud/watsonx-ai` SDK.

## Installation

```bash
npm install @langchain/ibm @langchain/core
```

## Components

### Chat Models

The `ChatWatsonx` class provides chat model support with tool calling, structured output, and streaming.

```typescript
import { ChatWatsonx } from "@langchain/ibm";

const model = new ChatWatsonx({
  model: "ibm/granite-3-8b-instruct",
  version: "2024-05-31",
  serviceUrl: "https://us-south.ml.cloud.ibm.com",
  projectId: "your-project-id",
  apiKey: "your-api-key",
  maxTokens: 200,
});

const result = await model.invoke("What is AI?");
console.log(result.content);
```

#### Streaming

```typescript
const stream = await model.stream("Tell me about machine learning");

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}
```

#### Tool Calling

```typescript
import { z } from "zod";

const modelWithTools = model.bindTools([
  {
    name: "get_weather",
    description: "Get the weather for a location",
    schema: z.object({
      location: z.string().describe("The city name"),
    }),
  },
]);

const response = await modelWithTools.invoke("What's the weather in NYC?");
```

#### Structured Output

```typescript
import { z } from "zod";

const structuredModel = model.withStructuredOutput(
  z.object({
    answer: z.string(),
    confidence: z.number(),
  })
);

const result = await structuredModel.invoke("What is 2+2?");
// result: { answer: "4", confidence: 1.0 }
```

#### Model Gateway

```typescript
const gatewayModel = new ChatWatsonx({
  model: "ibm/granite-3-8b-instruct",
  version: "2024-05-31",
  serviceUrl: "https://us-south.ml.cloud.ibm.com",
  modelGateway: true,
  apiKey: "your-api-key",
});
```

#### Deployment

```typescript
const deployedModel = new ChatWatsonx({
  version: "2024-05-31",
  serviceUrl: "https://us-south.ml.cloud.ibm.com",
  idOrName: "your-deployment-id",
  apiKey: "your-api-key",
});
```

### Text LLM

The `WatsonxLLM` class provides text-generation LLM support.

```typescript
import { WatsonxLLM } from "@langchain/ibm";

const llm = new WatsonxLLM({
  model: "ibm/granite-3-8b-instruct",
  version: "2024-05-31",
  serviceUrl: "https://us-south.ml.cloud.ibm.com",
  projectId: "your-project-id",
  apiKey: "your-api-key",
  maxNewTokens: 200,
  temperature: 0.7,
});

const result = await llm.invoke("Explain quantum computing");
console.log(result);
```

### Embeddings

The `WatsonxEmbeddings` class provides text embedding support.

```typescript
import { WatsonxEmbeddings } from "@langchain/ibm";

const embeddings = new WatsonxEmbeddings({
  model: "ibm/slate-125m-english-rtrvr-v2",
  version: "2024-05-31",
  serviceUrl: "https://us-south.ml.cloud.ibm.com",
  projectId: "your-project-id",
  apiKey: "your-api-key",
});

const vector = await embeddings.embedQuery("Hello world");
const vectors = await embeddings.embedDocuments(["Hello", "World"]);
```

### Document Reranking

The `WatsonxRerank` class provides document reranking support.

```typescript
import { WatsonxRerank } from "@langchain/ibm";
import { Document } from "@langchain/core/documents";

const reranker = new WatsonxRerank({
  model: "cross-encoder/ms-marco-minilm-l-12-v2",
  version: "2024-05-31",
  serviceUrl: "https://us-south.ml.cloud.ibm.com",
  projectId: "your-project-id",
  apiKey: "your-api-key",
});

const documents = [
  new Document({ pageContent: "Paris is the capital of France." }),
  new Document({ pageContent: "Berlin is the capital of Germany." }),
  new Document({ pageContent: "Tokyo is the capital of Japan." }),
];

const results = await reranker.compressDocuments(
  documents,
  "European capitals"
);
```

### Agent Toolkits

The `WatsonxToolkit` class provides access to watsonx.ai utility agent tools.

```typescript
import { WatsonxToolkit } from "@langchain/ibm";

const toolkit = await WatsonxToolkit.init({
  version: "2024-05-31",
  serviceUrl: "https://us-south.ml.cloud.ibm.com",
  apiKey: "your-api-key",
});

const tools = toolkit.getTools();
const searchTool = toolkit.getTool("GoogleSearch", { maxResults: 5 });
```

## Authentication

The package supports multiple authentication methods.

### IAM authentication

```typescript
{
  authType: "iam",
  apiKey: "your-api-key",
}
```

Passing only the API key is also supported (defaults to IAM authentication):

```typescript
{
  apiKey: "your-api-key",
}
```

### Bearer Token authentication

```typescript
{
  authType: "bearertoken",
  bearerToken: "your-token",
}
```

### IBM watsonx.ai software authentication

```typescript
{
  authType: "cp4d",
  username: "your-username",
  password: "your-password",
  authUrl: "your-cp4d-url",
}
```

### Legacy Property Names

For backward compatibility, the original `watsonxAI`-prefixed property names are still supported:

```typescript
{
  watsonxAIAuthType: "iam",
  watsonxAIApikey: "your-api-key",
}
```

**Note:** While both naming conventions are supported, we recommend using the shorter property names (`apiKey`, `authType`, etc.) for new code. Avoid mixing both styles for the same property.

## Related

- [IBM watsonx.ai documentation](https://cloud.ibm.com/docs/watsonx-ai)
- [LangChain.js documentation](https://js.langchain.com)
- [@ibm-cloud/watsonx-ai SDK](https://www.npmjs.com/package/@ibm-cloud/watsonx-ai)
