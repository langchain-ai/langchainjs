import fs from "fs";
import { fileURLToPath } from "node:url";
import * as path from "path";

import { describe, expect, test } from "@jest/globals";
import { MakerSuiteHub, MakerSuitePrompt } from "../googlemakersuitehub.js";
import { ChatGooglePaLM } from "../../../../chat_models/googlepalm.js";

describe("Google Maker Suite Hub", () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const chatFile = JSON.parse(
    fs.readFileSync(
      `${__dirname}/googlemakersuite-files/chatPrompt.json`,
      "utf8"
    )
  );
  const dataFile = JSON.parse(
    fs.readFileSync(
      `${__dirname}/googlemakersuite-files/dataPrompt.json`,
      "utf8"
    )
  );
  const textFile = JSON.parse(
    fs.readFileSync(
      `${__dirname}/googlemakersuite-files/textPrompt.json`,
      "utf8"
    )
  );

  // We don't need a real key
  // eslint-disable-next-line no-process-env
  process.env.GOOGLE_PALM_API_KEY = "test";

  describe("Prompt", () => {
    test("text type", () => {
      const prompt = new MakerSuitePrompt(textFile);
      expect(prompt.promptType).toEqual("text");
    });

    test("text template", () => {
      const prompt = new MakerSuitePrompt(textFile);
      const template = prompt.toTemplate();
      expect(template.template).toEqual(
        "What would be a good name for a company that makes {product}?"
      );
    });

    test("text model", () => {
      const prompt = new MakerSuitePrompt(textFile);
      const model = prompt.toModel();
      // console.log(model.lc_namespace);
      expect(model.lc_namespace).toEqual(["langchain", "llms", "googlepalm"]);
    });

    test("data type", () => {
      const prompt = new MakerSuitePrompt(dataFile);
      expect(prompt.promptType).toEqual("data");
    });

    test("data template", () => {
      const prompt = new MakerSuitePrompt(dataFile);
      const template = prompt.toTemplate();
      // console.log("data template", template.template);
      expect(template.template).toEqual(
        "Given a product description, you should return a name for that product that includes something about rainbows.\n" +
          "description: socks\n" +
          "product: spectrum socks\n" +
          "description: hair ties\n" +
          "product: rainbows^2\n" +
          "description: {description}\n" +
          "product: "
      );
    });

    test("data model", () => {
      const prompt = new MakerSuitePrompt(dataFile);
      const model = prompt.toModel();
      expect(model.lc_namespace).toEqual(["langchain", "llms", "googlepalm"]);
    });

    test("chat type", () => {
      const prompt = new MakerSuitePrompt(chatFile);
      expect(prompt.promptType).toEqual("chat");
    });

    test("chat model", () => {
      const prompt = new MakerSuitePrompt(chatFile);
      const model = prompt.toModel();
      expect(model.lc_namespace).toEqual([
        "langchain",
        "chat_models",
        "googlepalm",
      ]);
      expect((model as ChatGooglePaLM).examples).toEqual([
        {
          input: { content: "What time is it?" },
          output: { content: "2023-09-16T02:03:04-0500" },
        },
      ]);
    });
  });

  describe("MakerSuiteHub", () => {
    test("isValid no entry", () => {
      const nonexistentId = "nonexistent";
      const hub = new MakerSuiteHub({ cacheTimeout: 1000 });
      const entry = hub.cache[nonexistentId];
      const isValid = hub.isValid(entry);
      expect(isValid).toEqual(false);
    });

    test("isValid timeout 0", () => {
      // This should never be valid because the cache timeout will be 0
      const fakeId = "fake";
      const hub = new MakerSuiteHub({ cacheTimeout: 0 });
      const entry = {
        updated: Date.now(),
        prompt: new MakerSuitePrompt({
          textPrompt: {
            value: "test",
          },
        }),
      };
      hub.cache[fakeId] = entry;
      const isValid = hub.isValid(entry);
      expect(isValid).toEqual(false);
    });

    test("isValid valid", () => {
      const fakeId = "fake";
      const hub = new MakerSuiteHub({ cacheTimeout: 60000 });
      const entry = {
        updated: Date.now(),
        prompt: new MakerSuitePrompt({
          textPrompt: {
            value: "test",
          },
        }),
      };
      hub.cache[fakeId] = entry;
      const isValid = hub.isValid(entry);
      expect(isValid).toEqual(true);
    });

    test("isValid timeout", () => {
      const fakeId = "fake";
      const hub = new MakerSuiteHub({ cacheTimeout: 60000 });
      const entry = {
        updated: Date.now() - 100000,
        prompt: new MakerSuitePrompt({
          textPrompt: {
            value: "test",
          },
        }),
      };
      hub.cache[fakeId] = entry;
      const isValid = hub.isValid(entry);
      expect(isValid).toEqual(false);
    });
  });
});
