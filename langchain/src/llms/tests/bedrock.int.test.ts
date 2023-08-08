import { jest, test, expect } from "@jest/globals";
import { Bedrock } from "../bedrock.js";

function setupMock(
  expectedRegionName: string,
  expectedModelName: string,
  expectedPrompt: string
) {
  // Mock the underlying aws module
  jest.mock("aws-sigv4-fetch", () => ({
    createSignedFetcher: jest.fn(() => async (url: string, options: any) => {
      // Verify the URL (also extract the region and model from the url)
      const regex =
        /https:\/\/bedrock\.([^/]+)\.amazonaws\.com\/model\/([^/]+)\/invoke/;
      const matches = url.match(regex);
      if (!matches) {
        expect(matches).not.toBeNull();
        return;
      }
      const regionName: string = matches[1];
      const modelName: string = matches[2];
      expect(regionName).not.toBeNull();
      expect(modelName).not.toBeNull();
      expect(expectedModelName).toBe(modelName);
      expect(expectedRegionName).toBe(regionName);

      // Test input based on provider
      const provider = modelName.split(".")[0];

      // Expectation on parameters sent to the underlying API
      expect(options).not.toBeNull();
      expect(typeof options).toBe("object");
      expect(options.method).toBe("post");
      if (["ai21", "anthropic"].includes(provider)) {
        // These two providers expect the prompt text in the "prompt" json body parameter
        expect(JSON.parse(options.body).prompt).toBe(expectedPrompt);
      } else {
        // All other providers expect the prompt text in the "inputText" json body parameter
        expect(JSON.parse(options.body).inputText).toBe(expectedPrompt);
      }
      expect(options.headers).not.toBeNull();
      expect(typeof options.headers).toBe("object");
      expect(options.headers["Content-Type"]).toBe("application/json");
      expect(options.headers.accept).toBe("application/json");

      // Produce response based on underlying model being tested
      let response: object = {};
      if (provider === "anthropic") {
        response = {
          completion: "Hello! My name is Claude.",
        };
      } else if (provider === "ai21") {
        response = {
          completions: [{ data: { text: "Hello! My name is Claude." } }],
        };
      } else {
        // all other models
        response = {
          results: [{ outputText: "Hello! My name is Claude." }],
        };
      }

      return {
        json: () => response,
      };
    }),
  }));
}

test("Test Bedrock LLM: anthropic", async () => {
  jest.resetModules();
  const regionName = "us-east-1";
  const modelName = "anthropic.model";
  const prompt = "What is your name?";

  setupMock(regionName, modelName, prompt);

  const model = new Bedrock({
    maxTokens: 20,
    regionName,
    model: modelName,
  });

  const res = await model.call("What is your name?");
  expect(typeof res).toBe("string");
  expect(res).toBe("Hello! My name is Claude.");
}, 5000);

test("Test Bedrock LLM: ai21", async () => {
  jest.resetModules();
  const regionName = "us-east-1";
  const modelName = "ai21.j2-grande-instruct";
  const prompt = "What is your name?";

  setupMock(regionName, modelName, prompt);

  const model = new Bedrock({
    maxTokens: 20,
    regionName,
    model: modelName,
  });

  const res = await model.call("What is your name?");
  expect(typeof res).toBe("string");
  expect(res).toBe("Hello! My name is Claude.");
}, 5000);

test("Test Bedrock LLM: amazon", async () => {
  jest.resetModules();
  const regionName = "us-east-1";
  const modelName = "amazon.model";
  const prompt = "What is your name?";

  setupMock(regionName, modelName, prompt);

  const model = new Bedrock({
    maxTokens: 20,
    regionName,
    model: modelName,
  });

  const res = await model.call("What is your name?");
  expect(typeof res).toBe("string");
  expect(res).toBe("Hello! My name is Claude.");
}, 5000);

test("Test Bedrock LLM: other", async () => {
  jest.resetModules();
  const regionName = "us-east-1";
  const modelName = "other.model";
  const prompt = "What is your name?";

  setupMock(regionName, modelName, prompt);

  async function tryInstantiateModel() {
    const model = new Bedrock({
      maxTokens: 20,
      regionName,
      model: modelName,
    });
    console.log(model);
  }
  await expect(tryInstantiateModel).rejects.toThrowError(
    "Unknown model: 'other.model', only these are supported: ai21,anthropic,amazon"
  );
}, 5000);
