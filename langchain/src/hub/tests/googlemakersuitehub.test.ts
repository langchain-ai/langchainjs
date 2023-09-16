import fs from "fs";
import { fileURLToPath } from "node:url";
import * as path from "path";

import { describe, test } from "@jest/globals";
import { MakerSuitePrompt } from "../googlemakersuitehub.js";

describe("Google Maker Suite Hub", () => {

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const chatFile = JSON.parse(fs.readFileSync(`${__dirname}/googlemakersuite-files/chatPrompt.json`, "utf8"));
  const dataFile = JSON.parse(fs.readFileSync(`${__dirname}/googlemakersuite-files/dataPrompt.json`, "utf8"));
  const textFile = JSON.parse(fs.readFileSync(`${__dirname}/googlemakersuite-files/textPrompt.json`, "utf8"));

  describe("Prompt", () => {

    test("text type", () => {
      const prompt = new MakerSuitePrompt(textFile);
      expect(prompt.promptType).toEqual("text");
    });

    test("text template", () => {
      const prompt = new MakerSuitePrompt(textFile);
      const template = prompt.toTemplate();
      expect(template.template).toEqual("What would be a good name for a company that makes {product}?")
    });

    test("text model", () => {
      const prompt = new MakerSuitePrompt(textFile);
      const model = prompt.toModel();
      // console.log(model.lc_namespace);
      expect(model.lc_namespace).toEqual(["langchain", "llms", "googlepalm"]);
    })

    test("data type", () => {
      const prompt = new MakerSuitePrompt(dataFile);
      expect(prompt.promptType).toEqual("data")
    });

    test("chat type", () => {
      const prompt = new MakerSuitePrompt(chatFile);
      expect(prompt.promptType).toEqual("chat");
    })

  });

})