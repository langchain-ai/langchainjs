import { SerpAPILoader } from "../web/serpapi.js";
import { Document } from "../../document.js";

test("Test buildUrl method", () => {
  const loader = new SerpAPILoader({ q: "testQuery", apiKey: "testApiKey" });

  expect(loader.buildUrl()).toBe(
    "https://serpapi.com/search?api_key=testApiKey&q=testQuery"
  );
});

test("Test processResponseData method", () => {
  const loader = new SerpAPILoader({ q: "testQuery", apiKey: "testApiKey" });

  const data = {
    answer_box: { type: "calculator_result", result: "3.141592653589793" },
  };

  const documents = loader.processResponseData(data);
  expect(documents).toHaveLength(1);

  const document = documents[0];
  expect(document).toBeInstanceOf(Document);
  expect(document.pageContent).toBe(JSON.stringify(data.answer_box));
  expect(document.metadata).toEqual({
    source: "SerpAPI",
    responseType: "answer_box",
  });
});
