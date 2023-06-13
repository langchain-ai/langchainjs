/* eslint-disable @typescript-eslint/no-explicit-any */
import { VectaraStore, VectaraLibArgs } from "langchain/vectorstores/vectara";
import { FakeEmbeddings } from "../../../../langchain/embeddings.js";

export async function run() {
    // Create a store and fill it with some texts + metadata
    const args: VectaraLibArgs = {
        customer_id: Number(process.env.VECTARA_CUSTOMER_ID) ?? 0,
        corpus_id: Number(process.env.VECTARA_CORPUS_ID) ?? 0,
        api_key: process.env.VECTARA_API_KEY ?? ""
    };
    const store = await VectaraStore.fromTexts(
        ["hello world", "hi there", "how are you", "bye now"],
        [{ foo: "bar" }, { foo: "baz" }, { foo: "qux" }, { foo: "bar" }],
        new FakeEmbeddings(),       // Vectara has its own embeddings, so we don't need to get them separately
        args
    );

    // Search the index without any filters
    const results = await store.similaritySearch("hello world", 1);
    console.log(results);
    /*
    [ Document { pageContent: 'hello world', metadata: { foo: 'bar' } } ]
    */

    // Search the index with a filter, in this case, only return results where
    // the "foo" metadata key is equal to "baz", see the Vectara docs for more
    // https://docs.vectara.com
    const results2 = await store.similaritySearch("hello world", 1, { "foo": "baz" });
    console.log(results2);
    /*
    [ Document { pageContent: 'hi there', metadata: { foo: 'baz' } } ]
    */
}
