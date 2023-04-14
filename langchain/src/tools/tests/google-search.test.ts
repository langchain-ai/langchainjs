import { afterAll, beforeAll, expect, test } from "@jest/globals";
import GoogleSearchAPIWrapper from "../google-search.js";

let wrapper: GoogleSearchAPIWrapper;

beforeAll(() => {
  wrapper = new GoogleSearchAPIWrapper();
});

afterAll(() => {
  // eslint-disable-next-line no-process-env
  delete process.env.GOOGLE_CSE_ID;
  // eslint-disable-next-line no-process-env
  delete process.env.GOOGLE_API_KEY;
});

test("should return an array of search result metadata", async () => {
  const results = await wrapper.results(
    "typescript google search api wrapper",
    10
  );
  expect(results).toBeInstanceOf(Array);
  expect(results.length).toBeGreaterThan(0);
  expect(results[0]).toHaveProperty("title");
  expect(results[0]).toHaveProperty("link");
});

test("should return an error message if no good result is found", async () => {
  const results = await wrapper.results("yxvcfdfasfsdfdsfdsf23432sdf", 10);
  expect(results).toHaveLength(1);
  expect(results[0]).toHaveProperty(
    "title",
    "No good Google Search Result was found"
  );
  expect(results[0]).toHaveProperty("link", "");
});

test("should return a search response object", async () => {
  const response = await wrapper.run("typescript google search api wrapper");
  expect(response).toHaveProperty("kind");
  expect(response).toHaveProperty("items");
});

test("should throw an error if the search query is invalid", async () => {
  await expect(wrapper.run("")).rejects.toThrow();
});
