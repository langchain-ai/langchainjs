import { test, expect } from "@jest/globals";
import { AzureMLModel, DollyContentFormatter, GPT2ContentFormatter, HFContentFormatter, LlamaContentFormatter } from "../azure_ml.js";

test("Test AzureML LLama Call", async () => {
    const prompt = "What is the meaning of Foo?";
    const model = new AzureMLModel({
        contentFormatter: new LlamaContentFormatter()
    });
  
    const res = await model.call(prompt);
    expect(typeof res).toBe("string");
  
    console.log(res);
});

test("Test AzureML GPT2 Call", async () => {
    const prompt = "What is the meaning of Foo?";
    const model = new AzureMLModel({
        contentFormatter: new GPT2ContentFormatter()
    });
  
    const res = await model.call(prompt);
    expect(typeof res).toBe("string");
  
    console.log(res);
});

test("Test AzureML HF Call", async () => {
    const prompt = "What is the meaning of Foo?";
    const model = new AzureMLModel({
        contentFormatter: new HFContentFormatter()
    });
  
    const res = await model.call(prompt);
    expect(typeof res).toBe("string");
  
    console.log(res);
});

test("Test AzureML Dolly Call", async () => {
    const prompt = "What is the meaning of Foo?";
    const model = new AzureMLModel({
        contentFormatter: new DollyContentFormatter()
    });
  
    const res = await model.call(prompt);
    expect(typeof res).toBe("string");
  
    console.log(res);
});
