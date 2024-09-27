# @langchain/ibm

This package contains the LangChain.js intergations for Watsonx by IBM thtough their SDK.

## Installation

```bash npm2yarn
npm install @langchain/ibm
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you are using this package with other LangChain packages, you should make sure that all of the packages depend on the same instance of @langchain/core.
You can do so by adding appropriate field to your project's `package.json` like this:

```json
{
  "name": "your-project",
  "version": "0.0.0",
  "dependencies": {
    "@langchain/ibm": "^0.0.1",
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

This package contains the `WatsonxLLM` class, which is the recommended way to interface with the Watsonx series of models.

To use, install the requirements, and configure your environment depending on what type od authentication you will be using.


## IAM authentication
```bash
export WATSONX_AI_AUTH_TYPE=iam
export WATSONX_AI_APIKEY=<YOUR-APIKEY>
```

## Bearer token authentication
```bash
export WATSONX_AI_AUTH_TYPE=bearertoken
export WATSONX_AI_BEARER_TOKEN=<YOUR-BEARER-TOKEN>
```

### CP4D authentication
```bash
export WATSONX_AI_AUTH_TYPE=cp4d
export WATSONX_AI_USERNAME=<YOUR_USERNAME>
export WATSONX_AI_PASSWORD=<YOUR_PASSWORD>
export WATSONX_AI_URL=<URL>
```

Once these are places in your enviromental variables and object is initialized authentication will proceed automatically. 

Authentication can also be accomplished by passing these values as parameters to a new instance.

## IAM authentication
```typescript
import { WatsonxLLM } from "@langchain/ibm";

    const props = {
        version: "YYYY-MM-DD",
        serviceUrl: "<SERVICE_URL>",
        projectId: "<PROJECT_ID>",
        watsonxAIAuthType: "iam",
        watsonxAIApikey:"<YOUR-APIKEY>"
    };
    const instance = new WatsonxLLM(props);
```
## Bearer token authentication

```typescript
import { WatsonxLLM } from "@langchain/ibm";

    const props = {
        version: "YYYY-MM-DD",
        serviceUrl:  "<SERVICE_URL>",
        projectId: "<PROJECT_ID>",
        watsonxAIAuthType: "bearertoken",
        watsonxAIBearerToken:"<YOUR-BEARERTOKEN>"
    };
    const instance = new WatsonxLLM(props);
```
### CP4D authentication

```typescript
import { WatsonxLLM } from "@langchain/ibm";

    const props = {
        version: "YYYY-MM-DD",
        serviceUrl: "<SERVICE_URL>",
        projectId: "<PROJECT_ID>",
        watsonxAIAuthType: "cp4d",
        watsonxAIUsername:"<YOUR-USERNAME>",
        watsonxAIPassword:"<YOUR-PASSWORD>",
        watsonxAIUrl: "<url>"
    };
    const instance = new WatsonxLLM(props);
```

## Loading the model
You might need to adjust model parameters for different models or tasks. For more details on the parameters, refer to IBM's documentation.

```typescript
import { WatsonxLLM } from "@langchain/ibm";
    const props = { 
      decoding_method: "sample",
      max_new_tokens: 100,
      min_new_tokens: 1,
      temperature: 0.5,
      top_k: 50,
      top_p: 1,
    }
  const instance = new WatsonxLLM({
      version: "YYYY-MM-DD",
      serviceUrl: process.env.API_URL,
      projectId: "<PROJECT_ID>",
      spaceId: "<SPACE_ID>",
      idOrName: "<DEPLOYMENT_ID>",
      modelId: "<MODEL_ID>",
      ...props
    });
```
Note:
- You must provide spaceId, projectId or idOrName(deployment id) in order to proceed.
- Depending on the region of your provisioned service instance, use correct serviceUrl.
- You need to specify the model you want to use for inferencing through model_id.



## Props overwrittion
Passed props at initialization will last for the whole life cycle of the object, however you may overwrite them for a single method's call by passing second argument as below

```typescript
const result = await instance.invoke("Print hello world.", {
  modelId: "<NEW_MODEL_ID>",
  parameters:{
    max_new_tokens: 20,
  }
});
console.log(result);
```

## Text generation

```typescript
const result = await instance.invoke("Print hello world.");
console.log(result);

const results = await instance.generate(["Print hello world.", "Print bye, bye world!"]);
console.log(result);
```

## Streaming

```typescript
const result = await instance.stream("Print hello world.");
for await(let chunk of result){
  console.log(chunk);
}
```

## Tokenization
This package has it's custom getNumTokens implementation which returns exact amount of tokens that would be used.

```typescript
const tokens = await instance.getNumTokens("Print hello world.");
console.log(tokens)
```

## Embeddings
  Following package supports embeddings model, you can proceed with following code snipet.

```typescript
  import { WatsonxEmbeddings } from "@langchain/ibm";

  const instance = new WatsonxEmbeddings({
        version: "YYYY-MM-DD",
        serviceUrl: process.env.API_URL,
        projectId: "<PROJECT_ID>",
        spaceId: "<SPACE_ID>",
        idOrName: "<DEPLOYMENT_ID>",
        modelId: "<MODEL_ID>"
      });

  const result = await instance.embedQuery("Hello world!");
  console.log(result);
```