// noinspection DuplicatedCode

import fs from "fs";
import { fileURLToPath } from "node:url";
import * as path from "path";

import { describe, test } from "@jest/globals";
import {
  DriveFileReadConnection,
  MakerSuiteHub,
  MakerSuitePrompt,
} from "../googlemakersuitehub.js";
import { AsyncCaller } from "../../../../util/async_caller.js";
import { HumanMessage } from "../../../../schema/index.js";
import { ChatGooglePaLM } from "../../../../chat_models/googlepalm.js";
import { GooglePaLM } from "../../../../llms/googlepalm.js";

describe.skip("Google Maker Suite Hub Integration", () => {
  describe("Prompt", () => {
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

    test("text chain", async () => {
      const prompt = new MakerSuitePrompt(textFile);
      const chain = prompt.toChain();
      const result = await chain.invoke({
        product: "shoes",
      });
      console.log("text chain result", result);
      expect(result).toBeTruthy();
    });

    test("data chain", async () => {
      const prompt = new MakerSuitePrompt(dataFile);
      const chain = prompt.toChain();
      const result = await chain.invoke({
        description: "shoes",
      });
      console.log("data chain result", result);
      expect(result).toBeTruthy();
    });

    test("chat model", async () => {
      const prompt = new MakerSuitePrompt(chatFile);
      const model = prompt.toModel() as ChatGooglePaLM;
      const message = new HumanMessage("Hello!");
      const result = await model.call([message]);
      expect(result).toBeTruthy();
      console.log({ result });
    });
  });

  describe("Drive", () => {
    test("file get media", async () => {
      const fileId = "1IAWobj3BYvbj5X3JOAKaoXTcNJlZLdpK";
      const caller = new AsyncCaller({});
      const connection = new DriveFileReadConnection({ fileId }, caller);
      console.log("connection client", connection?.client);
      const result = await connection.request();
      console.log(result);
    });
  });

  describe("Hub", () => {
    const hub = new MakerSuiteHub();

    test("text model", async () => {
      const prompt = await hub.pull("1gxLasQIeQdwR4wxtV_nb93b_g9f0GaMm");
      const model = prompt.toModel() as GooglePaLM;
      const result = await model.call(
        "What would be a good name for a company that makes socks"
      );
      console.log("text chain result", result);
      expect(result).toBeTruthy();
    });

    test("text chain", async () => {
      const prompt = await hub.pull("1gxLasQIeQdwR4wxtV_nb93b_g9f0GaMm");
      const result = await prompt.toChain().invoke({ product: "socks" });
      console.log("text chain result", result);
      expect(result).toBeTruthy();
    });
  });
});
