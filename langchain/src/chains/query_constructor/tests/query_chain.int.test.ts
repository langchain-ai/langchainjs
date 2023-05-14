import { test } from "@jest/globals";
import { loadQueryContstructorChain } from "../base.js";
import { AttributeInfo } from "../schema.js";
import { Comparators, Comparison, Operators, StructuredQuery } from "../ir.js";
import { OpenAI } from "../../../llms/openai.js";

test("Query Chain Test", async () => {
  const sq1 = new StructuredQuery(
    "",
    new Comparison(Comparators.lt, "length", 90)
  );
  const sq3 = new StructuredQuery(
    "",
    new Comparison(Comparators.gt, "rating", 8.5)
  );
  const sq4 = new StructuredQuery(
    "",
    new Comparison(Comparators.eq, "director", "Greta Gerwig")
  );
  const attributeInfo: AttributeInfo[] = [
    {
      name: "genre",
      description: "The genre of the movie",
      type: "string or array of strings",
    },
    {
      name: "year",
      description: "The year the movie was released",
      type: "number",
    },
    {
      name: "director",
      description: "The director of the movie",
      type: "string",
    },
    {
      name: "rating",
      description: "The rating of the movie (1-10)",
      type: "number",
    },
    {
      name: "length",
      description: "The length of the movie in minutes",
      type: "number",
    },
  ];
  const documentContents = "Brief summary of a movie";

  const allowedComparators = Object.values(Comparators);
  const allowedOperators = Object.values(Operators);
  const llm = new OpenAI({ modelName: "gpt-3.5-turbo", temperature: 0 });
  const queryChain = loadQueryContstructorChain({
    llm,
    documentContents,
    attributeInfo,
    allowedComparators,
    allowedOperators,
  });

  const c1 = queryChain.call({
    query: "Which movies are less than 90 minutes?",
  });
  const c3 = queryChain.call({
    query: "Which movies are rated higher than 8.5?",
  });
  const c4 = queryChain.call({
    query: "Which movies are directed by Greta Gerwig?",
  });

  const [
    { [queryChain.outputKey]: r1 },
    { [queryChain.outputKey]: r3 },
    { [queryChain.outputKey]: r4 },
  ] = await Promise.all([c1, c3, c4]);

  expect(r1).toMatchObject(sq1);
  expect(r3).toMatchObject(sq3);
  expect(r4).toMatchObject(sq4);
});
