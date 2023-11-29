import { test, expect } from "@jest/globals";
import { AzureMLChatModel, LlamaContentFormatter } from "../azure_ml.js";

test("Test AzureML LLama Call", async () => {
    const prompt = "Hi Llama!";
    const chat = new AzureMLChatModel({
        contentFormatter: new LlamaContentFormatter()
    });
  
    const res = await chat.call([prompt]);
    expect(typeof res).toBe("string");
  
    console.log(res);
});