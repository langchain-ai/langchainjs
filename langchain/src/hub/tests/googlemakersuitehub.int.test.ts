import fs from "fs";
import { fileURLToPath } from "node:url";
import * as path from "path";

import { describe, test } from "@jest/globals";
import { MakerSuitePrompt } from "../googlemakersuitehub.js";

describe("Google Maker Suite Hub Integration", () => {

  describe("Prompt", () => {

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // const chatFile = JSON.parse(fs.readFileSync(`${__dirname}/googlemakersuite-files/chatPrompt.json`, "utf8"));
    // const dataFile = JSON.parse(fs.readFileSync(`${__dirname}/googlemakersuite-files/dataPrompt.json`, "utf8"));
    const textFile = JSON.parse(fs.readFileSync(`${__dirname}/googlemakersuite-files/textPrompt.json`, "utf8"));

    test("text chain", async () => {
      const prompt = new MakerSuitePrompt(textFile);
      const chain = prompt.toChain();
      const result = await chain.invoke({
        product: "shoes"
      });
      console.log("text chain result", result);
      expect(result).toBeTruthy();
    })

  })

})