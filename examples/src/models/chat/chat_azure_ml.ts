import {
  AzureMLChatOnlineEndpoint,
  LlamaContentFormatter,
} from "langchain/chat_models/azure_ml";

const model = new AzureMLChatOnlineEndpoint({
  endpointUrl: "YOUR_ENDPOINT_URL", // Or set as process.env.AZURE_ML_ENDPOINTURL
  endpointApiKey: "YOUR_ENDPOINT_API_KEY", // Or set as process.env.AZURE_ML_APIKEY
  contentFormatter: new LlamaContentFormatter(), // Only LLAMA currently supported.
});

const res = model.invoke("Foo");

console.log({ res });
