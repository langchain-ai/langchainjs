import { AzureMLChatModel, LlamaContentFormatter } from "langchain/chat_models/azure_ml";

const model = new AzureMLChatModel({
    endpointUrl: "YOUR_ENDPOINT_URL", // Or set as process.env.AZURE_ML_ENDPOINTURL
    endpointApiKey: "YOUR_ENDPOINT_API_KEY", // Or set as process.env.AZURE_ML_APIKEY
    deploymentName: "YOUR_MODEL_DEPLOYMENT_NAME", // Or set as process.env.AZURE_ML_NAME
    contentFormatter: new LlamaContentFormatter(), // Only LLAMA currently supported.
});

const res = model.call("Foo");

console.log({ res });