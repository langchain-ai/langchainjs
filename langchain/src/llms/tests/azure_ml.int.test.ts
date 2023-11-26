import { test, expect } from "@jest/globals";
import { AzureMLModel } from "../azure_ml.js";

test("Test AzureML Model", async () => {
    const prompt = "Foo";
    const model = new AzureMLModel({
        endpointUrl: process.env.AZURE_ML_ENDPOINTURL,
        endpointApiKey: process.env.AZURE_ML_APIKEY,
        deploymentName: process.env.AZURE_ML_NAME
    });
  
    const res = await model.call(prompt);
    expect(typeof res).toBe("string");
  
    console.log(res);
});
