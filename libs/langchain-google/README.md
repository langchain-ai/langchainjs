# LangChain Google

This package contains resources to access Google AI/ML models
and other Google services including VertexAI. Authorization to
these services use either an API Key or service account credentials
that are either stored on the local file system or are provided
through the Google Cloud Platform environment it is running on.

## Installation

```bash
$ yarn add @langchain/google
```

## Features

This package provides:

### Chat Models

- **ChatGoogle** - Base Google chat model with automatic platform detection
- **ChatVertexAI** - Google Vertex AI chat models (Gemini Pro, Gemini Pro Vision, etc.)
- **ChatGoogleGenerativeAI** - Google AI Studio chat models (formerly @langchain/google-genai)

### Language Models (LLMs)

- **GoogleLLM** - Base Google LLM with automatic platform detection
- **VertexAI** - Google Vertex AI language models

### Embeddings

- **GoogleEmbeddings** - Base Google embeddings with automatic platform detection
- **VertexAIEmbeddings** - Google Vertex AI embeddings
- **GoogleGenerativeAIEmbeddings** - Google AI Studio embeddings

### Multimodal Support

- Image inputs for vision models
- Support for various image formats (base64, URLs, GCS paths)

### Tool/Function Calling

- Full support for Google's function calling capabilities
- Tool binding and structured outputs

## Authorization

Authorization is depending on the platform your are using this package in.

### Node.js / Deno / Bun

You can authenticate through the use of an API Key, if it is supported for
the service you're using, or a Google Cloud Service Account.

To handle service accounts, this package uses the `google-auth-library`
package, and you may wish to consult the documentation for that library
about how it does so. But in short, classes in this package will use
credentials from the first of the following that apply:

1. An API Key that is passed to the constructor using the `apiKey` attribute
2. Credentials that are passed to the constructor using the `authInfo` attribute
3. An API Key that is set in the environment variable `API_KEY`
4. The Service Account credentials that are saved in a file. The path to
   this file is set in the `GOOGLE_APPLICATION_CREDENTIALS` environment
   variable.
5. If you are running on a Google Cloud Platform resource, or if you have
   logged in using `gcloud auth application-default login`, then the
   default credentials.

### Browser

Authorization is done through a Google Cloud Service Account.

To handle service accounts, this package uses the `web-auth-library`
package, and you may wish to consult the documentation for that library
about how it does so. But in short, classes in this package will use
credentials from the first of the following that apply:

1. An API Key that is passed to the constructor using the `apiKey` attribute
2. Credentials that are passed to the constructor using the `authInfo` attribute
3. An API Key that is set in the environment variable `API_KEY`
4. The Service Account credentials that are saved directly into the
   `GOOGLE_WEB_CREDENTIALS`
5. The Service Account credentials that are saved directly into the
   `GOOGLE_VERTEX_AI_WEB_CREDENTIALS` (deprecated)

## Usage Examples

### Chat Models

#### Basic Chat (Node.js)

```typescript
import { ChatGoogle } from "@langchain/google";

const model = new ChatGoogle({
  model: "gemini-1.5-pro",
  temperature: 0.7,
  apiKey: "your-api-key", // or set GOOGLE_API_KEY environment variable
});

const response = await model.invoke("Tell me a joke");
console.log(response.content);
```

#### Vertex AI Chat (Node.js)

```typescript
import { ChatVertexAI } from "@langchain/google";

const model = new ChatVertexAI({
  model: "gemini-1.5-pro",
  temperature: 0.7,
  location: "us-central1", // optional
  // Credentials will be automatically detected from environment
});

const response = await model.invoke("Explain quantum computing");
console.log(response.content);
```

#### Multimodal Chat with Images

```typescript
import fs from "node:fs";
import { ChatGoogle } from "@langchain/google";
import { HumanMessage } from "@langchain/core/messages";
import fs from "fs";

const model = new ChatGoogle({
  model: "gemini-1.5-pro-vision",
});

const image = fs.readFileSync("./image.jpg").toString("base64");
const message = new HumanMessage({
  content: [
    {
      type: "text",
      text: "What's in this image?",
    },
    {
      type: "image_url",
      image_url: `data:image/jpeg;base64,${image}`,
    },
  ],
});

const response = await model.invoke([message]);
console.log(response.content);
```

#### Web/Browser Usage

```typescript
import { ChatGoogle } from "@langchain/google/web";

const model = new ChatGoogle({
  model: "gemini-1.5-pro",
  authOptions: {
    credentials: JSON.parse(process.env.GOOGLE_WEB_CREDENTIALS),
  },
});

const response = await model.invoke("Hello!");
console.log(response.content);
```

### Language Models (LLMs)

```typescript
import { GoogleLLM } from "@langchain/google";

const llm = new GoogleLLM({
  model: "gemini-1.5-pro",
  temperature: 0.7,
  maxOutputTokens: 1000,
});

const response = await llm.invoke("Write a short story about AI");
console.log(response);
```

### Embeddings

#### Basic Embeddings

```typescript
import { GoogleEmbeddings } from "@langchain/google";

const embeddings = new GoogleEmbeddings({
  model: "text-embedding-004",
});

const vectors = await embeddings.embedDocuments([
  "Hello world",
  "How are you?",
  "Goodbye!",
]);

console.log(vectors[0].length); // Vector dimension
```

#### Vertex AI Embeddings

```typescript
import { VertexAIEmbeddings } from "@langchain/google";

const embeddings = new VertexAIEmbeddings({
  model: "text-embedding-004",
  location: "us-central1",
});

const vector = await embeddings.embedQuery("What is machine learning?");
console.log(vector);
```

### Function/Tool Calling

```typescript
import { ChatGoogle } from "@langchain/google";
import { z } from "zod";

const model = new ChatGoogle({
  model: "gemini-1.5-pro",
});

const weatherTool = {
  name: "get_weather",
  description: "Get the current weather for a location",
  parameters: z.object({
    location: z.string().describe("The city and state"),
    unit: z.enum(["celsius", "fahrenheit"]).optional(),
  }),
};

const modelWithTools = model.bindTools([weatherTool]);
const response = await modelWithTools.invoke(
  "What's the weather like in Paris?"
);
console.log(response.tool_calls);
```

### Streaming

```typescript
import { ChatGoogle } from "@langchain/google";

const model = new ChatGoogle({
  model: "gemini-1.5-pro",
});

const stream = await model.stream("Tell me a long story");
for await (const chunk of stream) {
  console.log(chunk.content);
}
```

## Advanced Usage

### Custom Authentication

```typescript
import { ChatGoogle } from "@langchain/google";

const model = new ChatGoogle({
  model: "gemini-1.5-pro",
  authOptions: {
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    credentials: {
      // Your custom credentials
    },
  },
});
```

### Batch Processing

```typescript
import { ChatGoogle } from "@langchain/google";

const model = new ChatGoogle({
  model: "gemini-1.5-pro",
});

const prompts = [
  "Summarize this article...",
  "Translate this text...",
  "Answer this question...",
];

const responses = await model.batch(prompts);
responses.forEach((response, index) => {
  console.log(`Response ${index + 1}:`, response.content);
});
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**

   - Ensure your API key or service account has the correct permissions
   - Check that environment variables are set correctly

2. **Rate Limiting**

   - Implement exponential backoff
   - Use batch processing for multiple requests

3. **Model Not Found**

   - Verify the model name is correct
   - Ensure the model is available in your region

4. **Browser CORS Issues**
   - Ensure your domain is authorized in the Google Cloud Console
   - Use appropriate CORS headers

### Getting Help

- [Google AI Documentation](https://ai.google.dev/docs)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [LangChain.js Documentation](https://js.langchain.com/)
- [GitHub Issues](https://github.com/langchain-ai/langchainjs/issues)

## Contributing

Contributions are welcome! Please see the [Contributing Guide](../../CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License.
