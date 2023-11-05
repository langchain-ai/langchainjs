import { test, expect } from "@jest/globals";
import { z } from "zod";
import { RunnableSequence } from "../../schema/runnable/index.js";
import { PromptTemplate } from "../../prompts/index.js";
import { OpenAI } from "../../llms/openai.js";
import { StructuredOutputParser } from "../../output_parsers/index.js";
import { GraphQLClientTool } from "../experimental/graphql.js";

describe("GraphQL Test Suite", () => {
  test("make a graphql query", async () => {
    const parser = StructuredOutputParser.fromZodSchema(
      z.object({
        query: z.string(),
        variables: z.object({}),
      })
    );

    const chain = RunnableSequence.from([
      PromptTemplate.fromTemplate(
        "Make a GraphQL query to get the country code of Germany.\n{format_instructions}\n{schema}"
      ),
      new OpenAI({ temperature: 0 }),
      parser,
      new GraphQLClientTool({
        endpoint: "https://countries.trevorblades.com",
      }),
    ]);

    const response = await chain.invoke({
      schema: `
      type Continent {
        code: ID!
        countries: [Country!]!
        name: String!
      }

      input ContinentFilterInput {
        code: StringQueryOperatorInput
      }

      type Country {
        awsRegion: String!
        capital: String
        code: ID!
        continent: Continent!
        currencies: [String!]!
        currency: String
        emoji: String!
        emojiU: String!
        languages: [Language!]!
        name(lang: String): String!
        native: String!
        phone: String!
        phones: [String!]!
        states: [State!]!
        subdivisions: [Subdivision!]!
      }

      input CountryFilterInput {
        code: StringQueryOperatorInput
        continent: StringQueryOperatorInput
        currency: StringQueryOperatorInput
        name: StringQueryOperatorInput
      }

      type Language {
        code: ID!
        name: String!
        native: String!
        rtl: Boolean!
      }

      input LanguageFilterInput {
        code: StringQueryOperatorInput
      }

      type Query {
        continent(code: ID!): Continent
        continents(filter: ContinentFilterInput = {}): [Continent!]!
        countries(filter: CountryFilterInput = {}): [Country!]!
        country(code: ID!): Country
        language(code: ID!): Language
        languages(filter: LanguageFilterInput = {}): [Language!]!
      }

      type State {
        code: String
        country: Country!
        name: String!
      }

      input StringQueryOperatorInput {
        eq: String
        in: [String!]
        ne: String
        nin: [String!]
        regex: String
      }

      type Subdivision {
        code: ID!
        emoji: String
        name: String!
      }
      `,
      format_instructions: parser.getFormatInstructions(),
    });

    expect(JSON.parse(response).data).toEqual({
      country: {
        code: "DE",
      },
    });
  });
});
