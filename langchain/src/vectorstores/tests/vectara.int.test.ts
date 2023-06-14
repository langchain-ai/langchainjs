/* eslint-disable no-process-env */
import { test, expect, beforeAll } from "@jest/globals";
import { FakeEmbeddings } from "../../embeddings/fake.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { Document } from "../../document.js";
import { VectaraLibArgs, VectaraStore } from "../vectara.js";

const getDocs = (): Document<Record<string, any>>[] => {
  const hashCode = (s: string) => {
    return s.split("").reduce((a, b) => {
      a = ((a << 5) - a + b.charCodeAt(0)) | 0;
      return a;
    }, 0);
  };

  // Some text from Lord of the Rings
  const englishOne =
    "It all depends on what you want. You can trust us to stick to you through thick and thin to the \
                    bitter end. And you can trust us to keep any secret of yours - closer than you keep it yourself. \
                    But you cannot trust us to let you face trouble alone, and go off without a word. We are your \
                    friends, Frodo. Anyway: there it is. We know most of what Gandalf has told you. We know a good \
                    deal about the Ring. We are horribly afraid - but we are coming with you; or following you \
                    like hounds.";
  const englishTwo =
    "Sam lay back, and stared with open mouth, and for a moment, between bewilderment and great joy, \
                    he could not answer. At last he gasped: “Gandalf! I thought you were dead! But then I thought I \
                    was dead myself. Is everything sad going to come untrue? What's happened to the world?";
  const frenchOne =
    "Par exemple, sur la planète Terre, l'homme a toujours supposé qu'il était plus intelligent que les dauphins \
                    parce qu'il avait accompli tant de choses - la roue, New York, les guerres, etc. passer du\
                    bon temps. Mais à l'inverse, les dauphins ont toujours cru qu'ils étaient bien plus \
                    intelligents que l'homme, pour les mêmes raisons précisément.";

  const documents = [
    new Document({
      pageContent: englishOne,
      metadata: {
        document_id: hashCode(englishOne).toString(), // Generate a hashcode for document id based on the text
        title: "Lord of the Rings",
        author: "Tolkien",
        genre: "fiction",
        lang: "eng",
      },
    }),
    new Document({
      pageContent: englishTwo,
      metadata: {
        document_id: hashCode(englishTwo).toString(), // Generate a hashcode for document id based on the text
        title: "Lord of the Rings",
        author: "Tolkien",
        genre: "fiction",
        lang: "eng",
      },
    }),
    new Document({
      pageContent: frenchOne,
      metadata: {
        document_id: hashCode(frenchOne).toString(), // Generate a hashcode for document id based on the text
        title: "The hitchhiker's guide to the galaxy",
        author: "Douglas Adams",
        genre: "fiction",
        lang: "fra",
      },
    }),
  ];
  return documents;
};

describe.skip("VectaraStore", () => {
  process.env.OPENAI_API_KEY =
    process.env.OPENAI_API_KEY ?? "this is a fake key";

  ["VECTARA_CUSTOMER_ID", "VECTARA_CORPUS_ID", "VECTARA_API_KEY"].forEach(
    (envVar) => {
      if (!process.env[envVar]) {
        throw new Error(`${envVar} not set`);
      }
    }
  );

  describe("fromTexts", () => {
    const args: VectaraLibArgs = {
      customer_id: Number(process.env.VECTARA_CUSTOMER_ID) || 0,
      corpus_id: Number(process.env.VECTARA_CORPUS_ID) || 0,
      api_key: process.env.VECTARA_API_KEY || "",
    };

    test("with embeddings throws error", () => {
      expect(() =>
        VectaraStore.fromTexts([], [], new OpenAIEmbeddings(), args)
      ).toThrow(
        "Vectara uses its own embeddings, so you don't have to provide any. Provide an instance of FakeEmbeddings to VectaraStore.fromTexts, instead of OpenAIEmbeddings."
      );
    });

    test("with fakeEmbeddings doesn't throw error", () => {
      expect(() =>
        VectaraStore.fromTexts([], [], new FakeEmbeddings(), args)
      ).not.toThrow();
    });
  });

  describe("fromDocuments", () => {
    const args: VectaraLibArgs = {
      customer_id: Number(process.env.VECTARA_CUSTOMER_ID) || 0,
      corpus_id: Number(process.env.VECTARA_CORPUS_ID) || 0,
      api_key: process.env.VECTARA_API_KEY || "",
    };

    test("with embeddings throws error", () => {
      // Ensure a fulfilled promise fails the test.
      expect.assertions(1);
      return VectaraStore.fromDocuments(
        getDocs(),
        new OpenAIEmbeddings(),
        args
      ).catch((e) =>
        expect(e.message).toEqual(
          "Vectara uses its own embeddings, so you don't have to provide any. Provide an instance of FakeEmbeddings to VectaraStore.fromDocuments, instead of OpenAIEmbeddings."
        )
      );
    });

    test("with fakeEmbeddings doesn't throw error", async () => {
      await expect(
        VectaraStore.fromDocuments(getDocs(), new FakeEmbeddings(), args)
      ).resolves.toBeDefined();
    });
  });

  describe("access operations", () => {
    let store: VectaraStore;

    beforeAll(async () => {
      store = new VectaraStore({
        customer_id: Number(process.env.VECTARA_CUSTOMER_ID) || 0,
        corpus_id: Number(process.env.VECTARA_CORPUS_ID) || 0,
        api_key: process.env.VECTARA_API_KEY || "",
      });
    });

    test("addDocuments", async () => {
      const indexResult = await store.addDocuments(getDocs());
      expect(indexResult.code).toEqual(200);
    });

    test("similaritySearchWithScore", async () => {
      const resultsWithScore = await store.similaritySearchWithScore(
        "What did Sam do?",
        10, // Number of results needed
        { lambda: 0.025 }
      );
      expect(resultsWithScore.length).toBeGreaterThan(0);
      expect(resultsWithScore[0][0].pageContent.length).toBeGreaterThan(0);
      expect(resultsWithScore[0][0].metadata.length).toBeGreaterThan(0);
      expect(resultsWithScore[0][1]).toBeGreaterThan(0);
    });

    test("similaritySearch", async () => {
      const results = await store.similaritySearch(
        "Was Gandalf dead?",
        10, // Number of results needed
        { lambda: 0.025 }
      );
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].pageContent.length).toBeGreaterThan(0);
      expect(results[0].metadata.length).toBeGreaterThan(0);
    });

    test("similaritySearch with filter", async () => {
      const results = await store.similaritySearch(
        "Was Gandalf dead?",
        10, // Number of results needed
        { filter: "part.lang = 'fra'", lambda: 0.025 } // Filter on the language of the document
      );
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].pageContent.length).toBeGreaterThan(0);
      expect(results[0].metadata.length).toBeGreaterThan(0);
      // Query filtered on French, so we expect only French results
      const hasEnglish = results.some((result) => {
        return (
          result.metadata.find((m: any) => m.name === "lang")?.value === "eng"
        );
      });
      expect(hasEnglish).toBe(false);
    });
  });
});
