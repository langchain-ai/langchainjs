import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

/*
 * Before running this, you should make sure you have created a
 * Google Cloud Project that has `generativelanguage` API enabled.
 *
 * You will also need to generate an API key and set
 * an environment variable GOOGLE_API_KEY
 *
 */

const embeddings = new GoogleGenerativeAIEmbeddings({
  modelName: "embedding-001",
});

const res = embeddings.embedQuery("OK Google");

console.log(res);
