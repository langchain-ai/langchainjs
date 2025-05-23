import {
  combineSentences,
  calculateCosineDistances,
} from "../semantic_chunker.js";

describe("combineSentences", () => {
  test("combines sentences with default sentencesToCombine (1)", () => {
    const sentences = [
      { sentence: "This is sentence one." },
      { sentence: "This is sentence two." },
      { sentence: "This is sentence three." },
    ];

    const result = combineSentences(sentences);

    expect(result).toEqual([
      {
        sentence: "This is sentence one.",
        combined_sentence: "This is sentence one. This is sentence two.",
      },
      {
        sentence: "This is sentence two.",
        combined_sentence:
          "This is sentence one. This is sentence two. This is sentence three.",
      },
      {
        sentence: "This is sentence three.",
        combined_sentence: "This is sentence two. This is sentence three.",
      },
    ]);
  });

  test("handles an empty array of sentences", () => {
    const sentences: any[] = [];

    const result = combineSentences(sentences);

    expect(result).toEqual([]);
  });

  test("handles a single sentence", () => {
    const sentences = [{ sentence: "Only one sentence here." }];

    const result = combineSentences(sentences);

    expect(result).toEqual([
      {
        sentence: "Only one sentence here.",
        combined_sentence: "Only one sentence here.",
      },
    ]);
  });
});

describe("calculateCosineDistances", () => {
  test("calculates cosine distances between sentence embeddings", () => {
    const sentences = [
      {
        sentence: "Sentence one.",
        combined_sentence_embedding: [1, 0, 0],
        distance_to_next: 0,
      },
      {
        sentence: "Sentence two.",
        combined_sentence_embedding: [0, 1, 0],
        distance_to_next: 0,
      },
      {
        sentence: "Sentence three.",
        combined_sentence_embedding: [0, 0, 1],
        distance_to_next: 0,
      },
    ];

    const [distances, updatedSentences] = calculateCosineDistances(sentences);

    expect(distances).toEqual([1, 1]);
    expect(updatedSentences).toEqual([
      {
        sentence: "Sentence one.",
        combined_sentence_embedding: [1, 0, 0],
        distance_to_next: 1,
      },
      {
        sentence: "Sentence two.",
        combined_sentence_embedding: [0, 1, 0],
        distance_to_next: 1,
      },
      {
        sentence: "Sentence three.",
        combined_sentence_embedding: [0, 0, 1],
        distance_to_next: 0,
      },
    ]);
  });

  test("handles a single sentence with no distances to calculate", () => {
    const sentences = [
      {
        sentence: "Only one sentence.",
        combined_sentence_embedding: [1, 0, 0],
        distance_to_next: 0,
      },
    ];

    const [distances, updatedSentences] = calculateCosineDistances(sentences);

    expect(distances).toEqual([]);
    expect(updatedSentences).toEqual([
      {
        sentence: "Only one sentence.",
        combined_sentence_embedding: [1, 0, 0],
        distance_to_next: 0,
      },
    ]);
  });

  test("handles an empty array of sentences", () => {
    const sentences: any[] = [];

    const [distances, updatedSentences] = calculateCosineDistances(sentences);

    expect(distances).toEqual([]);
    expect(updatedSentences).toEqual([]);
  });
});
