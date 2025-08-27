import { expect, test } from "vitest";
import { OpenAI } from "@langchain/openai";
import { loadQueryConstructorRunnable, AttributeInfo } from "../index.js";
import {
  Comparators,
  Comparison,
  Operation,
  Operators,
  StructuredQuery,
} from "../ir.js";
import { BasicTranslator } from "../../../retrievers/self_query/base.js";

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
  const sq5 = new StructuredQuery(
    "",
    new Operation(Operators.and, [
      new Operation(Operators.or, [
        new Comparison(Comparators.eq, "genre", "comedy"),
        new Comparison(Comparators.eq, "genre", "drama"),
      ]),
      new Comparison(Comparators.lt, "length", 90),
    ])
  );
  const sq6 = new StructuredQuery(
    "",
    new Comparison(Comparators.eq, "isReleased", true)
  );

  const filter1 = { length: { $lt: 90 } };
  const filter3 = { rating: { $gt: 8.5 } };
  const filter4 = { director: { $eq: "Greta Gerwig" } };
  const filter5 = {
    $and: [
      { $or: [{ genre: { $eq: "comedy" } }, { genre: { $eq: "drama" } }] },
      { length: { $lt: 90 } },
    ],
  };
  const filter6 = { isReleased: { $eq: true } };

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
    {
      name: "isReleased",
      description: "Whether the movie has been released",
      type: "boolean",
    },
  ];
  const documentContents = "Brief summary of a movie";

  const allowedComparators = Object.values(Comparators);
  const allowedOperators = Object.values(Operators);
  const llm = new OpenAI({
    modelName: "gpt-3.5-turbo-instruct",
    temperature: 0,
  });
  const queryChain = loadQueryConstructorRunnable({
    llm,
    documentContents,
    attributeInfo,
    allowedComparators,
    allowedOperators,
  });

  const c1 = queryChain.invoke({
    query: "Which movies are less than 90 minutes?",
  });
  const c3 = queryChain.invoke({
    query: "Which movies are rated higher than 8.5?",
  });
  const c4 = queryChain.invoke({
    query: "Which movies are directed by Greta Gerwig?",
  });
  const c5 = queryChain.invoke({
    query:
      "Which movies are either comedy or drama and are less than 90 minutes?",
  });
  const c6 = queryChain.invoke({
    query: "Which movies have already been released?",
  });

  const [r1, r3, r4, r5, r6] = await Promise.all([c1, c3, c4, c5, c6]);

  expect(r1).toMatchObject(sq1);
  expect(r3).toMatchObject(sq3);
  expect(r4).toMatchObject(sq4);
  expect(r5).toMatchObject(sq5);
  expect(r6).toMatchObject(sq6);
  const testTranslator = new BasicTranslator();

  const { filter: parsedFilter1 } = testTranslator.visitStructuredQuery(r1);
  const { filter: parsedFilter3 } = testTranslator.visitStructuredQuery(r3);
  const { filter: parsedFilter4 } = testTranslator.visitStructuredQuery(r4);
  const { filter: parsedFilter5 } = testTranslator.visitStructuredQuery(r5);
  const { filter: parsedFilter6 } = testTranslator.visitStructuredQuery(r6);

  expect(parsedFilter1).toMatchObject(filter1);
  expect(parsedFilter3).toMatchObject(filter3);
  expect(parsedFilter4).toMatchObject(filter4);
  expect(parsedFilter5).toMatchObject(filter5);
  expect(parsedFilter6).toMatchObject(filter6);
});
