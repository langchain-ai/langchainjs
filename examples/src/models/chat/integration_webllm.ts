import { ChatWebLLM } from "@langchain/community/chat_models/webllm";
import { HumanMessage } from "@langchain/core/messages";
import * as webllm from '@mlc-ai/web-llm'

// Initialize the ChatWebLLM model with the model record and chat options.
// Note that if the appConfig field is set, the list of model records 
// must include the selected model record for the engine.
const model = new ChatWebLLM({
    modelRecord: {
        "model_url": "https://huggingface.co/mlc-ai/Llama-3-8B-Instruct-q4f32_1-MLC/resolve/main/",
        "model_id": "Llama-3-8B-Instruct-q4f32_1",
        "model_lib_url": webllm.modelLibURLPrefix + webllm.modelVersion + "/Llama-3-8B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
    },
    chatOpts: {
        temperature: 0.5,
        top-p: 2,
    },
});

// Call the model with a message and await the response.
const response = await model.invoke([
    new HumanMessage({ content: "My name is John" }),
]);

