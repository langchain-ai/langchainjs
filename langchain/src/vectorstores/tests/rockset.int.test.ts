import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import rockset from "@rockset/client";
import { RocksetStore, RocksetStoreDestroyedError, SimilarityMetric } from "../rockset.js";
import { test, expect } from "@jest/globals";
import { Document } from "../../document.js";

const getPageContents = (docs: Document[]) => {
    return docs.map((doc) => doc.pageContent);
}

const embeddings = new OpenAIEmbeddings();
let store: RocksetStore | undefined = undefined;

const docs = [
    new Document({
      pageContent: "Tomatoes are red.",
      metadata: { subject: "tomatoes" },
    }),
    new Document({
        pageContent: "Tomatoes are small.",
        metadata: { subject: "tomatoes" },
    }),
    new Document({
        pageContent: "Apples are juicy.",
        metadata: { subject: "apples" },
    })
]

test("create new collection as a RocksetVectorStore", async () => {
    store = await RocksetStore.withNewCollection(embeddings, {
        collectionName: "langchain_demo",
        client: rockset.default(
            process.env.ROCKSET_API_KEY ?? "", 
            `https://api.${process.env.ROCKSET_API_REGION ?? "usw2a1"}.rockset.com`
        )
    });
});

test("add to RocksetVectorStore", async () => {
    expect(store).toBeDefined();
    expect((await store!.addDocuments(docs))?.length).toBe(docs.length);
});

test("query RocksetVectorStore with cosine sim", async () => {
    expect(store).toBeDefined();
    let relevantDocs = await store!.similaritySearch("What color are tomatoes?");
    expect(getPageContents(relevantDocs)).toEqual(getPageContents(relevantDocs));
});

test("query RocksetVectorStore with dot product", async () => {
    expect(store).toBeDefined();
    store!.similarityMetric = SimilarityMetric.DotProduct;
    let relevantDocs = await store!.similaritySearch("What color are tomatoes?");
    expect(getPageContents(relevantDocs)).toEqual(getPageContents(relevantDocs));
});

test("query RocksetVectorStore with euclidean distance", async () => {
    expect(store).toBeDefined();
    store!.similarityMetric = SimilarityMetric.EuclideanDistance;
    let relevantDocs = await store!.similaritySearch("What color are tomatoes?");
    expect(getPageContents(relevantDocs)).toEqual(getPageContents(relevantDocs));
});

test("query RocksetVectorStore with metadata filter", async () => {
    expect(store).toBeDefined();
    let relevantDocs = await store!.similaritySearch("What color are tomatoes?", undefined, "subject='apples'");
    expect(relevantDocs.length).toBe(1);
    expect(getPageContents(relevantDocs)).toEqual(getPageContents([docs[2]]));
});

test("query RocksetVectorStore with k", async () => {
    expect(store).toBeDefined();
    let relevantDocs = await store!.similaritySearch("What color are tomatoes?", 1);
    expect(relevantDocs.length).toBe(1);
});

test("destroy store", async() => {
    expect(store).toBeDefined();
    store!.destroy(true);
    expect(async () => {
        await store!.similaritySearch("Hello there!")
    }).rejects.toThrow(RocksetStoreDestroyedError);
});