import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  temperature: 0.9,
  azureOpenAIApiKey: "SOME_SECRET_VALUE", // In Node.js defaults to process.env.AZURE_OPENAI_API_KEY
  azureOpenAIApiVersion: "YOUR-API-VERSION", // In Node.js defaults to process.env.AZURE_OPENAI_API_VERSION
  azureOpenAIApiDeploymentName: "{DEPLOYMENT_NAME}", // In Node.js defaults to process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME
  azureOpenAIBasePath:
    "https://westeurope.api.microsoft.com/openai/deployments", // In Node.js defaults to process.env.AZURE_OPENAI_BASE_PATH
});
