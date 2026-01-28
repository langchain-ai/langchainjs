import { test } from "@jest/globals";
import { WatsonxEmbeddings } from "../ibm.js";

const projectId = process.env.WATSONX_AI_PROJECT_ID;
const version = "2024-05-31";
const serviceUrl = process.env.WATSONX_AI_SERVICE_URL as string;
const serviceUrlGateway = process.env.WATSONX_AI_SERVICE_URL_GATEWAY as string;
const model = "ibm/slate-125m-english-rtrvr-v2";
const modelAlias = "langchain-nodejs-ibm/slate-125m-english-rtrvr-v2";
const parameters = [
  {
    name: "projectId",
    params: { projectId, model, serviceUrl },
  },
  {
    name: "Model Gateway",
    params: {
      modelGateway: true,
      model: modelAlias,
      serviceUrl: serviceUrlGateway,
    },
  },
];
describe.each(parameters)("Test embeddings for $name", ({ params }) => {
  test("embedQuery method", async () => {
    const embeddings = new WatsonxEmbeddings({
      version,
      ...params,
    });
    const res = await embeddings.embedQuery("Hello world");
    expect(typeof res[0]).toBe("number");
  });

  test("embedDocuments", async () => {
    const embeddings = new WatsonxEmbeddings({
      version,
      ...params,
    });
    const res = await embeddings.embedDocuments(["Hello world", "Bye world"]);
    expect(res).toHaveLength(2);
    expect(typeof res[0][0]).toBe("number");
    expect(typeof res[1][0]).toBe("number");
  });

  test("Concurrency", async () => {
    const embeddings = new WatsonxEmbeddings({
      version,
      maxConcurrency: 4,
      ...params,
    });
    const res = await embeddings.embedDocuments([
      "Hello world",
      "Bye world",
      "Hello world",
      "Bye world",
      "Hello world",
      "Bye world",
      "Hello world",
      "Bye world",
    ]);
    expect(res).toHaveLength(8);
    expect(res.find((embedding) => typeof embedding[0] !== "number")).toBe(
      undefined
    );
  });

  test("List models", async () => {
    const embeddings = new WatsonxEmbeddings({
      version,
      maxConcurrency: 4,
      ...params,
    });
    const unresolvedRes = embeddings.listModels();

    if ("modelGateway" in params) {
      await expect(unresolvedRes).rejects.toThrow(
        /This method is not supported in model gateway/
      );
    } else {
      const res = await unresolvedRes;
      expect(res?.length).toBeGreaterThan(0);
      if (res) expect(typeof res[0]).toBe("string");
    }
  });
});
