import { test } from "@jest/globals";
import { StructuredQueryOutputParser } from "../base.js";
import {
  Comparator,
  Comparison,
  Operation,
  Operator,
  StructuredQuery,
} from "../ir.js";

const correctQuery = new StructuredQuery(
  "teenager love",
  new Operation(Operator.and, [
    new Operation(Operator.or, [
      new Comparison(Comparator.eq, "artist", "Taylor Swift"),
      new Comparison(Comparator.eq, "artist", "Katy Perry"),
    ]),
    new Comparison(Comparator.lt, "length", 180),
    new Comparison(Comparator.eq, "genre", "pop"),
  ])
);

test("StructuredQueryOutputParser test", async () => {
  const queryParser = StructuredQueryOutputParser.fromComponents(
    [
      Comparator.eq,
      Comparator.gte,
      Comparator.gt,
      Comparator.lte,
      Comparator.lt,
    ],
    [Operator.and, Operator.or, Operator.not]
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
