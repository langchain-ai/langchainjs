/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { beforeEach, expect, test } from "@jest/globals";
import { Embeddings } from "@langchain/core/embeddings";
import { SyntheticEmbeddings } from "../../utils/testing.js";
import { InMemoryDocstore } from "../../stores/doc/in_memory.js";
import { MatchingEngineArgs, MatchingEngine } from "../googlevertexai.js";

describe("Vertex AI matching", () => {
  let embeddings: Embeddings;
  let store: InMemoryDocstore;
  let config: MatchingEngineArgs;
  let engine: MatchingEngine;

  beforeEach(() => {
    embeddings = new SyntheticEmbeddings({
      vectorSize: Number.parseInt(
        process.env.SYNTHETIC_EMBEDDINGS_VECTOR_SIZE ?? "768",
        10
      ),
    });

    store = new InMemoryDocstore();

    config = {
      index: process.env.GOOGLE_VERTEXAI_MATCHINGENGINE_INDEX!,
      indexEndpoint: process.env.GOOGLE_VERTEXAI_MATCHINGENGINE_INDEXENDPOINT!,
      apiVersion: "v1beta1",
      docstore: store,
    };

    engine = new MatchingEngine(embeddings, config);
  });

  test("clean metadata", () => {
    const m = {
      alpha: "a",
      bravo: {
        uno: 1,
        dos: "two",
        tres: false,
        quatro: ["a", "b", "c", "d"],
        cinco: {
          prime: [1, 2],
          doublePrime: ["g", true],
        },
      },
      charlie: ["e", "f"],
    };
    const flat = engine.cleanMetadata(m);
    console.log("flatten metadata", flat);
    expect(flat.alpha).toEqual("a");
    expect(flat["bravo.uno"]).toEqual(1);
    expect(flat["bravo.dos"]).toEqual("two");
    expect(flat["bravo.tres"]).toEqual(false);
    expect(flat["bravo.quatro"]).toEqual(["a", "b", "c", "d"]);
    expect(flat["bravo.cinco.prime"]).toEqual(["1", "2"]);
    expect(flat["bravo.cinco.doublePrime"]).toEqual(["g", "true"]);
    expect(flat.charlie).toEqual(["e", "f"]);
  });

  test("restrictions", () => {
    const m = {
      alpha: "a",
      bravo: {
        uno: 1,
        dos: "two",
        tres: false,
        quatro: ["a", "b", "c", "d"],
        cinco: {
          prime: [1, 2],
          doublePrime: ["g", true],
        },
      },
      charlie: ["e", "f"],
    };
    const r = engine.metadataToRestrictions(m);
    console.log("restrictions", r);
    expect(r[0].namespace).toEqual("alpha");
    expect(r[0].allowList).toEqual(["a"]);
    expect(r[4].namespace).toEqual("bravo.quatro");
    expect(r[4].allowList).toEqual(["a", "b", "c", "d"]);
  });
});
