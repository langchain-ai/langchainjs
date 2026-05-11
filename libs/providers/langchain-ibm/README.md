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

### Legacy Property Names (Deprecated)

⚠️ **Deprecation Notice**: The original `watsonxAI`-prefixed property names are deprecated and will be removed in v1.0.0.

For backward compatibility, these legacy names are still supported:

```typescript
// ⚠️ Deprecated - will be removed in v1.0.0
{
  watsonxAIAuthType: "iam",
  watsonxAIApikey: "your-api-key",
  watsonxAIBearerToken: "your-token",
  watsonxAIUsername: "your-username",
  watsonxAIPassword: "your-password",
  watsonxAIUrl: "your-url",
}
```

**Migration**: Use the shorter property names instead:

```typescript
// ✅ Recommended - use these property names
{
  authType: "iam",
  apiKey: "your-api-key",
  bearerToken: "your-token",
  username: "your-username",
  password: "your-password",
  authUrl: "your-url",
}
```

**Important**:

- These properties are marked with `@deprecated` JSDoc tags for IDE warnings
- Do not mix legacy and new property names for the same property
- Update your code to use the new property names before v1.0.0

## Troubleshooting

### Common Issues and Solutions

#### Authentication Errors

**Problem**: `WatsonxAuthenticationError: You have not provided any type of authentication`

**Solution**: Ensure you provide valid authentication credentials. At minimum, you need:

```typescript
{
  serviceUrl: "https://us-south.ml.cloud.ibm.com",
  apiKey: "your-api-key",
}
```

**Problem**: `WatsonxAuthenticationError: ApiKey is required for IAM auth`

**Solution**: When using IAM authentication (default), provide an API key:

```typescript
{
  authType: "iam", // or omit for default
  apiKey: "your-api-key",
  serviceUrl: "https://us-south.ml.cloud.ibm.com",
}
```

**Problem**: `WatsonxAuthenticationError: Username and Password or ApiKey is required for IBM watsonx.ai software auth`

**Solution**: For CP4D authentication, provide username and password (or API key):

```typescript
{
  authType: "cp4d",
  username: "your-username",
  password: "your-password",
  authUrl: "https://your-cp4d-instance.com",
  serviceUrl: "https://your-cp4d-instance.com",
}
```

#### Configuration Errors

**Problem**: `WatsonxConfigurationError: No model provided! Model gateway expects model to be provided`

**Solution**: When using Gateway mode, always specify a model:

```typescript
{
  model: "ibm/granite-3-8b-instruct",
  modelGateway: true,
  // ... other config
}
```

**Problem**: `WatsonxConfigurationError: No id or model provided!`

**Solution**: Provide either a model with project/space ID, a deployment ID, or enable gateway mode:

```typescript
// Option 1: Project/Space mode
{
  model: "ibm/granite-3-8b-instruct",
  projectId: "your-project-id",
  // ...
}

// Option 2: Deployment mode
{
  idOrName: "your-deployment-id",
  // ...
}

// Option 3: Gateway mode
{
  model: "ibm/granite-3-8b-instruct",
  modelGateway: true,
  // ...
}
```

#### Validation Errors

**Problem**: `WatsonxValidationError: Maximum 1 id type can be specified per instance`

**Solution**: Use only ONE of: `projectId`, `spaceId`, `idOrName`, or `modelGateway`:

```typescript
// ❌ Wrong - multiple ID types
{
  projectId: "abc",
  spaceId: "xyz", // Error!
}

// ✅ Correct - single ID type
{
  projectId: "abc",
}
```

**Problem**: `WatsonxValidationError: Unexpected properties: ...`

**Solution**: Remove unsupported properties for your deployment mode. Each mode supports different properties:

- **Project/Space mode**: Supports `projectId` or `spaceId`, `model`, generation parameters
- **Deployment mode**: Supports `idOrName` only (no model or generation parameters)
- **Gateway mode**: Supports `modelGateway: true`, `model`, gateway-specific parameters

#### Network and Service Errors

**Problem**: SSL certificate errors

**Solution**: For development/testing with self-signed certificates (CP4D):

```typescript
{
  disableSSL: true, // Only for development!
  // ... other config
}
```

⚠️ **Warning**: Never use `disableSSL: true` in production environments.

#### Model-Specific Issues

**Problem**: Model not found or unavailable

**Solution**:

1. Verify the model name is correct and available in your region
2. Check if the model is available in your project/space
3. List available models:

```typescript
const llm = new WatsonxLLM({
  projectId: "your-project-id",
  serviceUrl: "https://us-south.ml.cloud.ibm.com",
  apiKey: "your-api-key",
});

const models = await llm.listModels();
console.log(models);
```

**Problem**: Token limit exceeded

**Solution**: Reduce `maxTokens` or `maxNewTokens`:

```typescript
{
  maxTokens: 100, // For chat models
  // or
  maxNewTokens: 100, // For LLMs
}
```

#### Streaming Issues

**Problem**: Streaming not working or incomplete responses

**Solution**:

1. Ensure streaming is enabled:

```typescript
{
  streaming: true,
}
```

2. Properly consume the stream:

```typescript
const stream = await model.stream("Your prompt");
for await (const chunk of stream) {
  console.log(chunk.content);
}
```

3. Check for errors in the stream:

```typescript
try {
  for await (const chunk of stream) {
    console.log(chunk.content);
  }
} catch (error) {
  console.error("Stream error:", error);
}
```

### Getting Help

If you continue to experience issues:

1. **Check the error type**: The package uses specific error classes (`WatsonxAuthenticationError`, `WatsonxConfigurationError`, etc.) that indicate the problem category

2. **Enable verbose logging**: Set the `verbose` option to see detailed information:

```typescript
{
  verbose: true,
  // ... other config
}
```

3. **Consult documentation**:
   - [IBM watsonx.ai documentation](https://cloud.ibm.com/docs/watsonx-ai)
   - [LangChain.js documentation](https://js.langchain.com)

4. **Report issues**: If you believe you've found a bug, please report it on the [LangChain.js GitHub repository](https://github.com/langchain-ai/langchainjs/issues)

## Related

- [IBM watsonx.ai documentation](https://cloud.ibm.com/docs/watsonx-ai)
- [LangChain.js documentation](https://js.langchain.com)
- [@ibm-cloud/watsonx-ai SDK](https://www.npmjs.com/package/@ibm-cloud/watsonx-ai)
