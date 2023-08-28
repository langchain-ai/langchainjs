import { test, expect } from "@jest/globals";
import { SyntheticEmbeddings } from "../fake.js";

test("Synthetic basic", async () => {
  const embed = new SyntheticEmbeddings({ vectorSize: 5 });
  const vector = await embed.embedQuery("aaaaaaaaaa");
  expect(vector).toHaveLength(5);
  expect(vector[0]).toEqual(0.46153846153846156);
  expect(vector[4]).toEqual(0.46153846153846156);
});

test("Synthetic Padding", async () => {
  const embed = new SyntheticEmbeddings({ vectorSize: 5 });
  const vector = await embed.embedQuery("aaaaaaaaa");
  expect(vector).toHaveLength(5);
  expect(vector[0]).toEqual(0.46153846153846156);
  expect(vector[4]).toEqual(0.9615384615384616);
});

test("Synthetic extreme padding", async () => {
  const embed = new SyntheticEmbeddings({ vectorSize: 768 });
  const vector = await embed.embedQuery("aa");
  expect(vector).toHaveLength(768);
  expect(vector[0]).toEqual(0.7307692307692307);
  expect(vector[1]).toEqual(0.7307692307692307);
  expect(vector[2]).toEqual(0);
});

test("Synthetic similarity", async () => {
  const embed = new SyntheticEmbeddings({ vectorSize: 2 });
  const v1 = await embed.embedQuery("this");
  const v2 = await embed.embedQuery("that");
  console.log(v1, v2);
  expect(v1).toHaveLength(2);
  expect(v2).toHaveLength(2);
  expect(v1[0]).toEqual(v2[0]);
  expect(v1[1]).not.toEqual(v2[1]);
});
