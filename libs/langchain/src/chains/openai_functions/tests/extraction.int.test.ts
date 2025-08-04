import { test, expect } from "@jest/globals";
import { z } from "zod";

import { ChatOpenAI } from "@langchain/openai";
import { createExtractionChainFromZod } from "../extraction.js";

test("extraction chain", async () => {
  const chain = createExtractionChainFromZod(
    z.object({
      "person-name": z.string().optional(),
      "person-age": z.number().optional(),
      "person-hair_color": z.string().optional(),
      "dog-name": z.string().optional(),
      "dog-breed": z.string().optional(),
    }),
    new ChatOpenAI({ model: "gpt-3.5-turbo-0613", temperature: 0 })
  );

  const result =
    await chain.run(`Alex is 5 feet tall. Claudia is 4 feet taller Alex and jumps higher than him. Claudia is a brunette and Alex is blonde.
    Alex's dog Frosty is a labrador and likes to play hide and seek.`);
  expect(result).toMatchInlineSnapshot(`
    [
      {
        "dog-breed": "labrador",
        "dog-name": "Frosty",
        "person-age": 0,
        "person-hair_color": "blonde",
        "person-name": "Alex",
      },
      {
        "dog-breed": "",
        "dog-name": "",
        "person-age": 0,
        "person-hair_color": "brunette",
        "person-name": "Claudia",
      },
    ]
  `);
});
