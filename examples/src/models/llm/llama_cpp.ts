import { LlamaCpp } from "langchain/llms/llama_cpp";

const llamaPath = "/Replace/with/path/to/your/model/gguf-llama2-q4_0.bin";
const question = "Where do Llamas come from?";

const model = new LlamaCpp({ modelPath: llamaPath });

console.log(`You: ${question}`);
const response = await model.invoke(question);
console.log(`AI : ${response}`);
