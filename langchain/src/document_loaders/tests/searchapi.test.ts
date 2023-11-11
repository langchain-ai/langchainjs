import { SearchApiLoader } from "../web/searchapi.js";
import { Document } from "../../document.js";

test("Test buildUrl method without engine", () => {
  const loader = new SearchApiLoader({ apiKey: "ApiKey", q: "Query" });

  expect(loader.buildUrl()).toBe(
    "https://www.searchapi.io/api/v1/search?engine=google&api_key=ApiKey&q=Query"
  );
});

test("Test buildUrl method with engine override", () => {
  const loader = new SearchApiLoader({
    engine: "google_news",
    apiKey: "ApiKey",
    q: "Query",
  });

  expect(loader.buildUrl()).toBe(
    "https://www.searchapi.io/api/v1/search?engine=google_news&api_key=ApiKey&q=Query"
  );
});

test("Test processResponseData method", () => {
  const loader = new SearchApiLoader({ apiKey: "ApiKey", q: "Query" });

  const data = {
    answer_box: { type: "organic_result", answer: "1918" },
  };

  const documents = loader.processResponseData(data);
  expect(documents).toHaveLength(1);

  const document = documents[0];
  expect(document).toBeInstanceOf(Document);
  expect(document.pageContent).toBe(JSON.stringify(data.answer_box));
  expect(document.metadata).toEqual({
    source: "SearchApi",
    responseType: "answer_box",
  });
});
