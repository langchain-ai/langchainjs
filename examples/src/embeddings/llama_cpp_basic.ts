import { LlamaCppEmbeddings } from "langchain/embeddings/llama_cpp";

const llamaPath = "/Replace/with/path/to/your/model/gguf-llama2-q4_0.bin";

const embeddings = new LlamaCppEmbeddings({
  modelPath: llamaPath,
});

const res = embeddings.embedQuery("Hello Llama!");

console.log(res);

/*
	[ 15043, 365, 29880, 3304, 29991 ]
*/
