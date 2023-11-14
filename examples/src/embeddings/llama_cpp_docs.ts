import { LlamaCppEmbeddings } from "langchain/embeddings/llama_cpp";

const llamaPath = "/Replace/with/path/to/your/model/gguf-llama2-q4_0.bin";

const documents = ["Hello World!", "Bye Bye!"];

const embeddings = new LlamaCppEmbeddings({
  modelPath: llamaPath,
});

const res = await embeddings.embedDocuments(documents);

console.log(res);

/*
	[ [ 15043, 2787, 29991 ], [ 2648, 29872, 2648, 29872, 29991 ] ]
*/
