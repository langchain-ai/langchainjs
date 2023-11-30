import { ChatLlamaCpp } from "langchain/chat_models/llama_cpp";

const llamaPath = "/Replace/with/path/to/your/model/gguf-llama2-q4_0.bin";

const model = new ChatLlamaCpp({ modelPath: llamaPath, temperature: 0.7 });

const stream = await model.stream("Tell me a short story about a happy Llama.");

for await (const chunk of stream) {
  console.log(chunk.content);
}

/*

  Once
   upon
   a
   time
  ,
   in
   a
   green
   and
   sunny
   field
  ...
*/
