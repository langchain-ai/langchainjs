import { test } from "@jest/globals";
import { StructuredQueryOutputParser } from "../index.js";
import {
  Comparators,
  Comparison,
  Operation,
  Operators,
  StructuredQuery,
} from "../ir.js";

const correctQuery = new StructuredQuery(
  "teenager love",
  new Operation(Operators.and, [
    new Operation(Operators.or, [
      new Comparison(Comparators.eq, "artist", "Taylor Swift"),
      new Comparison(Comparators.eq, "artist", "Katy Perry"),
    ]),
    new Comparison(Comparators.lt, "length", 180),
    new Comparison(Comparators.eq, "genre", "pop"),
  ])
);

test("StructuredQueryOutputParser test", async () => {
  const queryParser = StructuredQueryOutputParser.fromComponents(
    [
      Comparators.eq,
      Comparators.gte,
      Comparators.gt,
      Comparators.lte,
      Comparators.lt,
    ],
    [Operators.and, Operators.or, Operators.not]
  );

  const exampleOutput = `json\`\`\`
{
    "query": "teenager love",
    "filter": "and(or(eq(\\"artist\\", \\"Taylor Swift\\"), eq(\\"artist\\", \\"Katy Perry\\")), lt(\\"length\\", 180), eq(\\"genre\\", \\"pop\\"))"
}
\`\`\``;

  const parsedOutput = await queryParser.parse(exampleOutput);
  expect(parsedOutput).toMatchObject(correctQuery);
});
