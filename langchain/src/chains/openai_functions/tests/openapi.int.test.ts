import { test } from "@jest/globals";

import { ChatOpenAI } from "@langchain/openai";
import { createOpenAPIChain } from "../openapi.js";

test("OpenAPI chain with a provided full spec", async () => {
  const chain = await createOpenAPIChain(
    {
      openapi: "3.0.1",
      info: { version: "v0", title: "Open AI Klarna product Api" },
      servers: [{ url: "https://www.klarna.com/us/shopping" }],
      tags: [
        {
          name: "open-ai-product-endpoint",
          description: "Open AI Product Endpoint. Query for products.",
        },
      ],
      paths: {
        "/public/openai/v0/products": {
          get: {
            tags: ["open-ai-product-endpoint"],
            summary: "API for fetching Klarna product information",
            operationId: "productsUsingGET",
            parameters: [
              {
                name: "countryCode",
                in: "query",
                description:
                  "ISO 3166 country code with 2 characters based on the user location. Currently, only US, GB, DE, SE and DK are supported.",
                required: true,
                schema: { type: "string" },
              },
              {
                name: "q",
                in: "query",
                description:
                  "A precise query that matches one very small category or product that needs to be searched for to find the products the user is looking for. If the user explicitly stated what they want, use that as a query. The query is as specific as possible to the product name or category mentioned by the user in its singular form, and don't contain any clarifiers like latest, newest, cheapest, budget, premium, expensive or similar. The query is always taken from the latest topic, if there is a new topic a new query is started. If the user speaks another language than English, translate their request into English (example: translate fia med knuff to ludo board game)!",
                required: true,
                schema: { type: "string" },
              },
              {
                name: "size",
                in: "query",
                description: "number of products returned",
                required: false,
                schema: { type: "integer" },
              },
              {
                name: "min_price",
                in: "query",
                description:
                  "(Optional) Minimum price in local currency for the product searched for. Either explicitly stated by the user or implicitly inferred from a combination of the user's request and the kind of product searched for.",
                required: false,
                schema: { type: "integer" },
              },
              {
                name: "max_price",
                in: "query",
                description:
                  "(Optional) Maximum price in local currency for the product searched for. Either explicitly stated by the user or implicitly inferred from a combination of the user's request and the kind of product searched for.",
                required: false,
                schema: { type: "integer" },
              },
            ],
            responses: {
              "200": {
                description: "Products found",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/ProductResponse" },
                  },
                },
              },
              "503": { description: "one or more services are unavailable" },
            },
            deprecated: false,
          },
        },
      },
      components: {
        schemas: {
          Product: {
            type: "object",
            properties: {
              attributes: { type: "array", items: { type: "string" } },
              name: { type: "string" },
              price: { type: "string" },
              url: { type: "string" },
            },
            title: "Product",
          },
          ProductResponse: {
            type: "object",
            properties: {
              products: {
                type: "array",
                items: { $ref: "#/components/schemas/Product" },
              },
            },
            title: "ProductResponse",
          },
        },
      },
    },
    { llm: new ChatOpenAI({ model: "gpt-4-0613", temperature: 0 }) }
  );

  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await chain.run(
    `What are some options for a men's large blue button down shirt`
  );
  // console.log(result);
});

test("OpenAPI chain with yml spec from a URL", async () => {
  const chain = await createOpenAPIChain(
    "https://gist.githubusercontent.com/roaldnefs/053e505b2b7a807290908fe9aa3e1f00/raw/0a212622ebfef501163f91e23803552411ed00e4/openapi.yaml",
    {
      llm: new ChatOpenAI({ model: "gpt-4-0613", temperature: 0 }),
    }
  );
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await chain.run(`What's today's comic?`);
  // console.log(result);
});

test("OpenAPI chain with yml spec from a URL with a path parameter", async () => {
  const chain = await createOpenAPIChain(
    "https://gist.githubusercontent.com/roaldnefs/053e505b2b7a807290908fe9aa3e1f00/raw/0a212622ebfef501163f91e23803552411ed00e4/openapi.yaml",
    {
      llm: new ChatOpenAI({ model: "gpt-4-0613", temperature: 0 }),
    }
  );
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await chain.run(`What comic has id 2184?`);
  // console.log(result);
});

test("OpenAPI chain with yml spec from a URL requiring a POST request", async () => {
  const chain = await createOpenAPIChain("https://api.speak.com/openapi.yaml", {
    llm: new ChatOpenAI({ model: "gpt-4-0613", temperature: 0 }),
  });
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await chain.run(`How would you say no thanks in Russian?`);
  // console.log(result);
});

test("OpenAPI chain with a longer spec and tricky query required params", async () => {
  const chain = await createOpenAPIChain(
    "https://scholar-ai.net/openapi.yaml",
    {
      params: {
        sort: "cited_by_count",
      },
    }
  );
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const result = await chain.run(
    "Can you find and explain some articles about the intersection of AI and VR?"
  );
  // console.log(result);
});
