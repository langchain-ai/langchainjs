import { AzureOpenAI } from "@langchain/openai";

const model = new AzureOpenAI({
  azureOpenAIApiKey: "<your_key>", // In Node.js defaults to process.env.AZURE_OPENAI_API_KEY
  azureOpenAIApiDeploymentName: "<your_deployment_name>", // In Node.js defaults to process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME
  azureOpenAIApiVersion: "<api_version>", // In Node.js defaults to process.env.AZURE_OPENAI_API_VERSION
  azureOpenAIBasePath:
    "https://westeurope.api.microsoft.com/openai/deployments", // In Node.js defaults to process.env.AZURE_OPENAI_BASE_PATH
});
