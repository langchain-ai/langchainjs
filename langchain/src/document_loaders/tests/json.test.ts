import * as url from "node:url";
import * as path from "node:path";
import { test, expect } from "@jest/globals";
import { Document } from "../../document.js";
import { JSONLoader } from "../fs/json.js";

test("Test JSON loader", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/Star_Wars_The_Clone_Wars_S06E07_Crisis_at_the_Heart.json"
  );
  const loader = new JSONLoader(filePath);
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

test("Test JSON loader from inmemory JSON", async() => {
    const json = [
      "<i>Corruption discovered at the core of the Banking Clan!</i>",
      "<i>Reunited, Rush Clovis and Senator Amidala</i>",
      "<i>discover the full extent of the deception.</i>",
      "<i>Anakin Skywalker is sent to the rescue!</i>",
      "<i>He refuses to trust Clovis and asks Padm not to work with him.</i>",
      "<i>Determined to save the banks, she refuses her husband's request,</i>",
      "<i>throwing their relationship into turmoil.</i>",
      "<i>Voted for by both the Separatists and the Republic,</i>",
      "<i>Rush Clovis is elected new leader of the Galactic Banking Clan.</i>",
      "<i>Now, all attention is focused on Scipio</i>",
      "<i>as the important transfer of power begins.</i>"
  ];
  const loader = new JSONLoader("");
  const docs = await loader.load(json);
  expect(docs.length).toBe(11);
  expect(docs[0]).toEqual(
    new Document({
      metadata: { source: "json", line: 1 },
      pageContent:
        "<i>Corruption discovered at the core of the Banking Clan!</i>",
    })
  );
});

test("Test JSON loader for complex json without keys", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/complex.json"
  );
  const loader = new JSONLoader(filePath);
  const docs = await loader.load();

  expect(docs.length).toBe(10);
  expect(docs[0]).toEqual(
    new Document({
      metadata: { source: filePath, line: 1 },
      pageContent: "BD 2023 SUMMER",
    })
  );
  expect(docs[1]).toEqual(
    new Document({
      metadata: { source: filePath, line: 2 },
      pageContent: "LinkedIn Job",
    })
  );
  expect(docs[2]).toEqual(
    new Document({
      metadata: { source: filePath, line: 3 },
      pageContent: "IMPORTANT",
    })
  );
});

test("Test JSON loader for complex json with one key that points nothing", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/complex.json"
  );
  const loader = new JSONLoader(filePath, ["/plop"]);
  const docs = await loader.load();

  expect(docs.length).toBe(0);
});

test("Test JSON loader for complex json with one key that exists", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/complex.json"
  );
  const loader = new JSONLoader(filePath, ["/from"]);
  const docs = await loader.load();

  expect(docs.length).toBe(2);
  expect(docs[1]).toEqual(
    new Document({
      metadata: { source: filePath, line: 2 },
      pageContent: "LinkedIn Job2",
    })
  );
});

test("Test JSON loader for complex json with two keys that exists", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/complex.json"
  );
  const loader = new JSONLoader(filePath, ["/from", "/labels"]);
  const docs = await loader.load();

  expect(docs.length).toBe(6);
  expect(docs[3]).toEqual(
    new Document({
      metadata: { source: filePath, line: 4 },
      pageContent: "INBOX",
    })
  );
});

test("Test JSON loader for complex json with two existing keys on different level", async () => {
  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/complex.json"
  );
  const loader = new JSONLoader(filePath, ["/from", "/surname"]);
  const docs = await loader.load();

  expect(docs.length).toBe(3);
  expect(docs[2]).toEqual(
    new Document({
      metadata: { source: filePath, line: 3 },
      pageContent: "bob",
    })
  );
});
