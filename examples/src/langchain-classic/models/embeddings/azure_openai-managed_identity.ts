import {
  DefaultAzureCredential,
  getBearerTokenProvider,
} from "@azure/identity";
import { AzureOpenAIEmbeddings } from "@langchain/openai";

const credentials = new DefaultAzureCredential();
const azureADTokenProvider = getBearerTokenProvider(
  credentials,
  "https://cognitiveservices.azure.com/.default"
);

const model = new AzureOpenAIEmbeddings({
  azureADTokenProvider,
  azureOpenAIApiInstanceName: "<your_instance_name>",
  azureOpenAIApiEmbeddingsDeploymentName: "<your_embeddings_deployment_name>",
  azureOpenAIApiVersion: "<api_version>",
});
