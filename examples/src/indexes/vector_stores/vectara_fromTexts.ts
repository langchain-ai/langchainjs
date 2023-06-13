/* eslint-disable @typescript-eslint/no-explicit-any */
import { VectaraStore, VectaraLibArgs } from "langchain/vectorstores/vectara";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

export async function run() {
    // Create a store and fill it with some texts + metadata
    await VectaraStore.fromTexts(
        ["hello world", "hi there", "how are you", "bye now"],
        [{ foo: "bar" }, { foo: "baz" }, { foo: "qux" }, { foo: "bar" }],
        new OpenAIEmbeddings(),
        {
            customer_id: process.env.VECTARA_CUSTOMER_ID ?,
            corpus_id: process.env.VECTARA_CORPUS_ID ?,
            api_key: process.env.VECTARA_API_KEY ?
        }
    );
}
