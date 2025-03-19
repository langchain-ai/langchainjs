import { LlamaCppEmbeddings } from "@langchain/community/embeddings/llama_cpp";

const llamaPath = "/Replace/with/path/to/your/model/gguf-llama2-q4_0.bin";

const embeddings = await LlamaCppEmbeddings.initialize({
  modelPath: llamaPath,
});

const res = embeddings.embedQuery("Hello Llama!");

console.log(res);

/*
	[ 15043, 365, 29880, 3304, 29991 ]
*/
