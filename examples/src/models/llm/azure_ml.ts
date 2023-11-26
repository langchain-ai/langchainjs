import { AzureMLModel } from "langchain/llms/azure_ml";

const model = new AzureMLModel({
    endpointUrl: "YOUR_ENDPOINT_URL", // Or set as process.env.AZURE_ML_ENDPOINTURL
    endpointApiKey: "YOUR_ENDPOINT_API_KEY", // Or set as process.env.AZURE_ML_APIKEY
    deploymentName: "YOUR_MODEL_DEPLOYMENT_NAME", // Or set as process.env.AZURE_ML_NAME
});

const res = model.call("Foo");

console.log({ res });