import { LlamaCpp } from "@langchain/community/llms/llama_cpp";

const llamaPath = "/Replace/with/path/to/your/model/gguf-llama2-q4_0.bin";
const question = "Where do Llamas come from?";

const model = await LlamaCpp.initialize({ modelPath: llamaPath });

console.log(`You: ${question}`);
const response = await model.invoke(question);
console.log(`AI : ${response}`);
