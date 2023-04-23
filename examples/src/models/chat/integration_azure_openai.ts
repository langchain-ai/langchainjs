import { ChatOpenAI } from "langchain/chat_models/openai";

const model = new ChatOpenAI({
  temperature: 0.9,
  azureOpenAIApiKey: "YOUR-AOAI-API-KEY", // In Node.js defaults to process.env.AZURE_OPENAI_API_KEY
  azureOpenAIApiInstanceName: "YOUR-AOAI-INSTANCE-NAME", // In Node.js defaults to process.env.AZURE_OPENAI_API_INSTANCE_NAME
  azureOpenAIApiDeploymentName: "YOUR-AOAI-DEPLOYMENT-NAME", // In Node.js defaults to process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME
  azureOpenAIApiVersion: "YOUR-AOAI-API-VERSION", // In Node.js defaults to process.env.AZURE_OPENAI_API_VERSION
});
