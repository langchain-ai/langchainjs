import * as url from "node:url";
import * as path from "node:path";
import { test, expect } from "@jest/globals";
import { Document } from "@langchain/core/documents";
import { JSONLinesLoader } from "../fs/json.js";

test("Test JSON loader from file", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.jsonl"
  );
  const loader = new JSONLinesLoader(filePath, "/html");
  const docs = await loader.load();
  expect(docs.length).toBe(32);
  expect(docs[0]).toEqual(
    new Document({
      metadata: { source: filePath, line: 1 },
      pageContent:
        "<i>Corruption discovered at the core of the Banking Clan!</i>",
    })
  );
});

test("Test JSON loader from complex JSONL file", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/ml_training.jsonl"
  );
  const loader = new JSONLinesLoader(filePath, "/contents");
  const docs = await loader.load();

  expect(docs.length).toBe(2);
  expect(docs[0].metadata).toEqual({ source: filePath, line: 1 });
  const [user, model] = JSON.parse(docs[0].pageContent);
  const userData = JSON.parse(user.parts[0].text);
  expect(userData.supplier.name).toEqual("BASF GmbH");
  const modelData = JSON.parse(model.parts[0].text);
  expect(modelData.is_company).toBeTruthy();
});
