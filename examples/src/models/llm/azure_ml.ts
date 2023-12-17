import {
  AzureMLOnlineEndpoint,
  LlamaContentFormatter,
} from "langchain/llms/azure_ml";

const model = new AzureMLOnlineEndpoint({
  endpointUrl: "YOUR_ENDPOINT_URL", // Or set as process.env.AZURE_ML_ENDPOINTURL
  endpointApiKey: "YOUR_ENDPOINT_API_KEY", // Or set as process.env.AZURE_ML_APIKEY
  deploymentName: "YOUR_MODEL_DEPLOYMENT_NAME", // Or set as process.env.AZURE_ML_NAME
  contentFormatter: new LlamaContentFormatter(), // Or any of the other Models: GPT2ContentFormatter, HFContentFormatter, DollyContentFormatter
});

const res = model.invoke("Foo");

console.log({ res });
