> [!IMPORTANT]
> This package is now deprecated in favor of the new Azure integration in the OpenAI SDK. Please use the package [`@langchain/openai`](https://www.npmjs.com/package/@langchain/openai) instead.
> You can find the migration guide [here](https://js.langchain.com/v0.2/docs/integrations/llms/azure#migration-from-azure-openai-sdk).

# @langchain/azure-openai

This package contains the Azure SDK for OpenAI LangChain.js integrations.

It provides Azure OpenAI support through the [Azure SDK for OpenAI](https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/openai/openai) library. 

## Installation

```bash npm2yarn
npm install @langchain/azure-openai
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you are using this package with other LangChain packages, you should make sure that all of the packages depend on the same instance of @langchain/core.
You can do so by adding appropriate fields to your project's `package.json` like this:

```json
{
  "name": "your-project",
  "version": "0.0.0",
  "dependencies": {
    "@langchain/azure-openai": "^0.0.4",
    "langchain": "0.0.207"
  },
  "resolutions": {
    "@langchain/core": "0.1.5"
  },
  "overrides": {
    "@langchain/core": "0.1.5"
  },
  "pnpm": {
    "overrides": {
      "@langchain/core": "0.1.5"
    }
  }
}
```

The field you need depends on the package manager you're using, but we recommend adding a field for the common `yarn`, `npm`, and `pnpm` to maximize compatibility.

## Chat Models

This package contains the `AzureChatOpenAI` class, which is the recommended way to interface with deployed models on Azure OpenAI.

To use, install the requirements, and configure your environment.

```bash
export AZURE_OPENAI_API_ENDPOINT=<your_endpoint>
export AZURE_OPENAI_API_KEY=<your_key>
export AZURE_OPENAI_API_DEPLOYMENT_NAME=<your_deployment_name>
```

Then initialize the model and make the calls:

```typescript
import { AzureChatOpenAI } from "@langchain/azure-openai";

const model = new AzureChatOpenAI({
  // Note that the following are optional, and will default to the values below
  // if not provided.
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_API_ENDPOINT,
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
});
const response = await model.invoke(new HumanMessage("Hello world!"));
```

### Streaming

```typescript
import { AzureChatOpenAI } from "@langchain/azure-openai";

const model = new AzureChatOpenAI({
  // Note that the following are optional, and will default to the values below
  // if not provided.
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_API_ENDPOINT,
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
});
const response = await model.stream(new HumanMessage("Hello world!"));
```

## Embeddings

This package also supports embeddings with Azure OpenAI.

```typescript
import { AzureOpenAIEmbeddings } from "@langchain/azure-openai";

const embeddings = new AzureOpenAIEmbeddings({
  // Note that the following are optional, and will default to the values below
  // if not provided.
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_API_ENDPOINT,
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_EMBEDDINGS_DEPLOYMENT_NAME,
});
const res = await embeddings.embedQuery("Hello world");
```

## Using Azure managed identity

If you're using [Azure Managed Identity](https://learn.microsoft.com/azure/ai-services/openai/how-to/managed-identity), you can also pass the credentials directly to the constructor:

```typescript
import { DefaultAzureCredential } from "@azure/identity";
import { AzureOpenAI } from "@langchain/azure-openai";

const credentials = new DefaultAzureCredential();

const model = new AzureOpenAI({
  credentials,
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_API_ENDPOINT,
  azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
});
```

## Compatibility with OpenAI API

This library is provides compatibility with the OpenAI API. You can use an API key from OpenAI's developer portal like in the example below:

```typescript
import { AzureOpenAI, OpenAIKeyCredential } from "@langchain/azure-openai";

const model = new AzureOpenAI({
  modelName: "gpt-3.5-turbo",
  credentials: new OpenAIKeyCredential("<your_openai_api_key>"),
});
```

## Development

To develop the Azure OpenAI package, you'll need to follow these instructions:

### Install dependencies

```bash
yarn install
```

### Build the package

```bash
yarn build
```

Or from the repo root:

```bash
yarn build --filter=@langchain/azure-openai
```

### Run tests

Test files should live within a `tests/` file in the `src/` folder. Unit tests should end in `.test.ts` and integration tests should
end in `.int.test.ts`:

```bash
$ yarn test
$ yarn test:int
```

### Lint & Format

Run the linter & formatter to ensure your code is up to standard:

```bash
yarn lint && yarn format
```

### Adding new entrypoints

If you add a new file to be exported, either import & re-export from `src/index.ts`, or add it to `scripts/create-entrypoints.js` and run `yarn build` to generate the new entrypoint.
