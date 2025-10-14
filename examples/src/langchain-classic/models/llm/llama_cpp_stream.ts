import { LlamaCpp } from "@langchain/community/llms/llama_cpp";

const llamaPath = "/Replace/with/path/to/your/model/gguf-llama3-Q4_0.bin";

const model = await LlamaCpp.initialize({
  modelPath: llamaPath,
  temperature: 0.7,
});

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
