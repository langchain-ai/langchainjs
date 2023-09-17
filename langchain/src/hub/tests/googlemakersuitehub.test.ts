import fs from "fs";
import { fileURLToPath } from "node:url";
import * as path from "path";

import { describe, test } from "@jest/globals";
import { MakerSuitePrompt } from "../googlemakersuitehub.js";
import {ChatGooglePaLM} from "../../chat_models/googlepalm.js";

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
    })

    test("data model", () => {
      const prompt = new MakerSuitePrompt(dataFile);
      const model = prompt.toModel();
      expect(model.lc_namespace).toEqual(["langchain", "llms", "googlepalm"]);
    })

    test("chat type", () => {
      const prompt = new MakerSuitePrompt(chatFile);
      expect(prompt.promptType).toEqual("chat");
    })

    test("chat model", () => {
      const prompt = new MakerSuitePrompt(chatFile);
      const model = prompt.toModel();
      expect(model.lc_namespace).toEqual(["langchain", "chat_models", "googlepalm"]);
      expect((model as ChatGooglePaLM).examples).toEqual([
        {
          input: { content: 'What time is it?' },
          output: { content: '2023-09-16T02:03:04-0500' }
        }
      ]);
    })

  });

})