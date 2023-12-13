import { LlamaCpp } from "langchain/llms/llama_cpp";

const llamaPath = "/Replace/with/path/to/your/model/gguf-llama2-q4_0.bin";

const model = new LlamaCpp({ modelPath: llamaPath, temperature: 0.7 });

const prompt = "Tell me a short story about a happy Llama.";

const stream = await model.stream(prompt);

for await (const chunk of stream) {
  console.log(chunk);
}

/*


 Once
  upon
  a
  time
 ,
  in
  the
  rolling
  hills
  of
  Peru
 ...
 */
