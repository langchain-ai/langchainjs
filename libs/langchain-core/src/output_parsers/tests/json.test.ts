import { describe, test, expect } from "vitest";
import { ChatPromptTemplate } from "../../prompts/chat.js";
import { RunnableSequence } from "../../runnables/base.js";
import { RunnablePassthrough } from "../../runnables/passthrough.js";
import { FakeStreamingLLM } from "../../utils/testing/index.js";
import { JsonOutputParser } from "../json.js";
import { AIMessage } from "../../messages/ai.js";

async function acc(iter: AsyncGenerator<object>): Promise<object[]> {
  const acc = [];
  for await (const chunk of iter) {
    acc.push(chunk);
  }
  return acc;
}

async function* streamChunks(chunks: string[]): AsyncGenerator<string> {
  for (const chunk of chunks) {
    yield chunk;
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 0);
    });
  }
}

const STREAMED_TOKENS = `
{

 "
setup
":
 "
Why
 did
 the
 bears
 start
 a
 band
 called
 Bears
 Bears
 Bears
 ?
"
,
 "
punchline
":
 "
Because
 they
 wanted
 to
 play
 bear
 -y
 good
 music
 !
"
,
 "
audience
":
 [
"
Haha
"
,
 "
So
 funny
"
]

}
`.split("\n");

const EXPECTED_STREAMED_JSON = [
  {},
  { setup: "" },
  { setup: "Why" },
  { setup: "Why did" },
  { setup: "Why did the" },
  { setup: "Why did the bears" },
  { setup: "Why did the bears start" },
  { setup: "Why did the bears start a" },
  { setup: "Why did the bears start a band" },
  { setup: "Why did the bears start a band called" },
  { setup: "Why did the bears start a band called Bears" },
  { setup: "Why did the bears start a band called Bears Bears" },
  { setup: "Why did the bears start a band called Bears Bears Bears" },
  { setup: "Why did the bears start a band called Bears Bears Bears ?" },
  {
    setup: "Why did the bears start a band called Bears Bears Bears ?",
    punchline: "",
  },
  {
    setup: "Why did the bears start a band called Bears Bears Bears ?",
    punchline: "Because",
  },
  {
    setup: "Why did the bears start a band called Bears Bears Bears ?",
    punchline: "Because they",
  },
  {
    setup: "Why did the bears start a band called Bears Bears Bears ?",
    punchline: "Because they wanted",
  },
  {
    setup: "Why did the bears start a band called Bears Bears Bears ?",
    punchline: "Because they wanted to",
  },
  {
    setup: "Why did the bears start a band called Bears Bears Bears ?",
    punchline: "Because they wanted to play",
  },
  {
    setup: "Why did the bears start a band called Bears Bears Bears ?",
    punchline: "Because they wanted to play bear",
  },
  {
    setup: "Why did the bears start a band called Bears Bears Bears ?",
    punchline: "Because they wanted to play bear -y",
  },
  {
    setup: "Why did the bears start a band called Bears Bears Bears ?",
    punchline: "Because they wanted to play bear -y good",
  },
  {
    setup: "Why did the bears start a band called Bears Bears Bears ?",
    punchline: "Because they wanted to play bear -y good music",
  },
  {
    setup: "Why did the bears start a band called Bears Bears Bears ?",
    punchline: "Because they wanted to play bear -y good music !",
  },
  {
    punchline: "Because they wanted to play bear -y good music !",
    setup: "Why did the bears start a band called Bears Bears Bears ?",
    audience: [],
  },
  {
    punchline: "Because they wanted to play bear -y good music !",
    setup: "Why did the bears start a band called Bears Bears Bears ?",
    audience: [""],
  },
  {
    punchline: "Because they wanted to play bear -y good music !",
    setup: "Why did the bears start a band called Bears Bears Bears ?",
    audience: ["Haha"],
  },
  {
    punchline: "Because they wanted to play bear -y good music !",
    setup: "Why did the bears start a band called Bears Bears Bears ?",
    audience: ["Haha", ""],
  },
  {
    punchline: "Because they wanted to play bear -y good music !",
    setup: "Why did the bears start a band called Bears Bears Bears ?",
    audience: ["Haha", "So"],
  },
  {
    punchline: "Because they wanted to play bear -y good music !",
    setup: "Why did the bears start a band called Bears Bears Bears ?",
    audience: ["Haha", "So funny"],
  },
];

const EXPECTED_STREAMED_JSON_DIFF = [
  [{ op: "replace", path: "", value: {} }],
  [{ op: "add", path: "/setup", value: "" }],
  [{ op: "replace", path: "/setup", value: "Why" }],
  [{ op: "replace", path: "/setup", value: "Why did" }],
  [{ op: "replace", path: "/setup", value: "Why did the" }],
  [{ op: "replace", path: "/setup", value: "Why did the bears" }],
  [{ op: "replace", path: "/setup", value: "Why did the bears start" }],
  [{ op: "replace", path: "/setup", value: "Why did the bears start a" }],
  [{ op: "replace", path: "/setup", value: "Why did the bears start a band" }],
  [
    {
      op: "replace",
      path: "/setup",
      value: "Why did the bears start a band called",
    },
  ],
  [
    {
      op: "replace",
      path: "/setup",
      value: "Why did the bears start a band called Bears",
    },
  ],
  [
    {
      op: "replace",
      path: "/setup",
      value: "Why did the bears start a band called Bears Bears",
    },
  ],
  [
    {
      op: "replace",
      path: "/setup",
      value: "Why did the bears start a band called Bears Bears Bears",
    },
  ],
  [
    {
      op: "replace",
      path: "/setup",
      value: "Why did the bears start a band called Bears Bears Bears ?",
    },
  ],
  [{ op: "add", path: "/punchline", value: "" }],
  [{ op: "replace", path: "/punchline", value: "Because" }],
  [{ op: "replace", path: "/punchline", value: "Because they" }],
  [{ op: "replace", path: "/punchline", value: "Because they wanted" }],
  [{ op: "replace", path: "/punchline", value: "Because they wanted to" }],
  [{ op: "replace", path: "/punchline", value: "Because they wanted to play" }],
  [
    {
      op: "replace",
      path: "/punchline",
      value: "Because they wanted to play bear",
    },
  ],
  [
    {
      op: "replace",
      path: "/punchline",
      value: "Because they wanted to play bear -y",
    },
  ],
  [
    {
      op: "replace",
      path: "/punchline",
      value: "Because they wanted to play bear -y good",
    },
  ],
  [
    {
      op: "replace",
      path: "/punchline",
      value: "Because they wanted to play bear -y good music",
    },
  ],
  [
    {
      op: "replace",
      path: "/punchline",
      value: "Because they wanted to play bear -y good music !",
    },
  ],
  [{ op: "add", path: "/audience", value: [] }],
  [{ op: "add", path: "/audience/0", value: "" }],
  [{ op: "replace", path: "/audience/0", value: "Haha" }],
  [{ op: "add", path: "/audience/1", value: "" }],
  [{ op: "replace", path: "/audience/1", value: "So" }],
  [{ op: "replace", path: "/audience/1", value: "So funny" }],
];

const MARKDOWN_STREAM_TEST_CASES = [
  {
    name: "Markdown with split code block",
    input: ['```json\n{"', 'countries": [{"n', 'ame": "China"}]}', "\n```"],
    expected: [{}, { countries: [{}] }, { countries: [{ name: "China" }] }],
  },
  {
    name: "Markdown without json identifier, split",
    input: ['```\n{"', 'key": "val', '"}\n```'],
    expected: [{}, { key: "val" }],
  },
  {
    name: "Ignores text after closing markdown backticks",
    input: ["```json\n", '{ "data": 123 }', "\n```", " Some extra text"],
    expected: [{ data: 123 }],
  },
];

describe("Markdown Streaming Scenarios", () => {
  for (const testCase of MARKDOWN_STREAM_TEST_CASES) {
    test(testCase.name, async () => {
      const parser = new JsonOutputParser();
      const result = await acc(
        parser.transform(streamChunks(testCase.input), {})
      );
      expect(result).toEqual(testCase.expected);
    });
  }
});

test("Handles markdown with text around code block", async () => {
  const input = [
    "Explanation:\n```json\n{",
    '"answer": 42',
    "}\n```\nConclusion",
  ];

  const expected = [{}, { answer: 42 }];

  const parser = new JsonOutputParser();
  const result = await acc(parser.transform(streamChunks(input), {}));
  expect(result).toEqual(expected);
});

test("Handles multiple code blocks in single chunk", async () => {
  const input = ['```json\n{"a":1}\n```\n```json\n{"b":2}\n```'];

  const parser = new JsonOutputParser();
  const result = await acc(
    parser.transform(
      (async function* () {
        yield input[0];
      })(),
      {}
    )
  );
  expect(result).toEqual([{ a: 1 }]);
});

test("JSONOutputParser parses streamed JSON", async () => {
  async function* generator() {
    for (const token of STREAMED_TOKENS) {
      yield token;
    }
  }
  const parser = new JsonOutputParser();
  const result = await acc(parser.transform(generator(), {}));
  expect(result).toEqual(EXPECTED_STREAMED_JSON);
  await expect(parser.parse(STREAMED_TOKENS.join(""))).resolves.toEqual(
    EXPECTED_STREAMED_JSON[EXPECTED_STREAMED_JSON.length - 1]
  );
});

test("JSONOutputParser traces streamed JSON as just the last chunk", async () => {
  async function* generator() {
    for (const token of STREAMED_TOKENS) {
      yield token;
    }
  }
  const parser = new JsonOutputParser();
  let tracedOutput;
  const result = await acc(
    parser.transform(generator(), {
      callbacks: [
        {
          handleChainEnd(outputs) {
            tracedOutput = outputs;
          },
        },
      ],
    })
  );
  expect(result.at(-1)).toEqual(tracedOutput);
});

test("JSONOutputParser parses streamed JSON diff", async () => {
  async function* generator() {
    for (const token of STREAMED_TOKENS) {
      yield token;
    }
  }
  const parser = new JsonOutputParser({ diff: true });
  let tracedOutput;
  const result = await acc(
    parser.transform(generator(), {
      callbacks: [
        {
          handleChainEnd(outputs) {
            tracedOutput = outputs;
          },
        },
      ],
    })
  );
  expect(result).toEqual(EXPECTED_STREAMED_JSON_DIFF);
  expect(tracedOutput).toEqual(
    EXPECTED_STREAMED_JSON_DIFF.map((patch) => patch[0])
  );
});

test("JsonOutputParser supports a type param", async () => {
  type CypherEvaluationChainInput = {
    question: string;
    cypher: string;
    schema: string;
    errors: string[];
  };

  type CypherEvaluationChainOutput = {
    cypher: string;
    errors: string[];
  };

  const prompt = ChatPromptTemplate.fromTemplate(
    `{errors} {question} {cypher} {schema}`
  );
  const llm = new FakeStreamingLLM({
    responses: [`{"cypher":"testoutput","errors":["testerror"]}`],
  });

  const chain = RunnableSequence.from<
    CypherEvaluationChainInput,
    CypherEvaluationChainOutput
  >([
    RunnablePassthrough.assign<CypherEvaluationChainInput>({
      // Convert array of strings into single string
      errors: ({ errors }) =>
        Array.isArray(errors) ? errors.join("\n") : errors,
    }),
    prompt,
    llm,
    new JsonOutputParser<CypherEvaluationChainOutput>(),
  ]);
  const result = await chain.invoke({
    question: "test",
    cypher: "test",
    schema: "test",
    errors: ["test"],
  });
  expect(result).toEqual({
    cypher: "testoutput",
    errors: ["testerror"],
  });
});

const GOOD_JSON = `\`\`\`json
{
    "foo": "bar"
}
\`\`\``;

const JSON_WITH_NEW_LINES = `

\`\`\`json
{
    "foo": "bar"
}
\`\`\`

`;

const JSON_WITH_NEW_LINES_INSIDE = `\`\`\`json
{

    "foo": "bar"

}
\`\`\``;

const JSON_WITH_NEW_LINES_EVERYWHERE = `

\`\`\`json

{

    "foo": "bar"

}

\`\`\`

`;

const TICKS_WITH_NEW_LINES_EVERYWHERE = `

\`\`\`

{

    "foo": "bar"

}

\`\`\`

`;

const JSON_WITH_ESCAPED_DOUBLE_QUOTES_IN_NESTED_JSON = `\`\`\`json
{
    "action": "Final Answer",
    "action_input": "{\\"foo\\": \\"bar\\", \\"bar\\": \\"foo\\"}"
}
\`\`\``;

const NO_TICKS = `{
    "foo": "bar"
}`;

const NO_TICKS_WHITE_SPACE = `
{
    "foo": "bar"
}
`;

const TEXT_BEFORE = `Thought: I need to use the search tool

Action:
\`\`\`
{
  "foo": "bar"
}
\`\`\``;

const TEXT_AFTER = `\`\`\`
{
  "foo": "bar"
}
\`\`\`
This should do the trick`;

const TEXT_BEFORE_AND_AFTER = `Action: Testing

\`\`\`
{
  "foo": "bar"
}
\`\`\`
This should do the trick`;

const TEST_CASES = [
  GOOD_JSON,
  JSON_WITH_NEW_LINES,
  JSON_WITH_NEW_LINES_INSIDE,
  JSON_WITH_NEW_LINES_EVERYWHERE,
  TICKS_WITH_NEW_LINES_EVERYWHERE,
  NO_TICKS,
  NO_TICKS_WHITE_SPACE,
  TEXT_BEFORE,
  TEXT_AFTER,
  TEXT_BEFORE_AND_AFTER,
];

const EXPECTED_JSON = {
  foo: "bar",
};

for (const test_case of TEST_CASES) {
  test(`JSONOutputParser parses ${test_case}`, async () => {
    async function* generator() {
      for (const token of test_case) {
        yield token;
      }
    }
    const parser = new JsonOutputParser();
    const result = await acc(parser.transform(generator(), {}));
    expect(result[result.length - 1]).toEqual(EXPECTED_JSON);
    await expect(parser.parse(test_case)).resolves.toEqual(EXPECTED_JSON);
  });
}

const TEST_CASES_ESCAPED_QUOTES = [
  JSON_WITH_ESCAPED_DOUBLE_QUOTES_IN_NESTED_JSON,
];

const EXPECTED_JSON_ESCAPED_QUOTES = {
  action: "Final Answer",
  action_input: '{"foo": "bar", "bar": "foo"}',
};

for (const test_case of TEST_CASES_ESCAPED_QUOTES) {
  test(`JSONOutputParser parses ${test_case}`, async () => {
    async function* generator() {
      for (const token of test_case) {
        yield token;
      }
    }
    const parser = new JsonOutputParser();
    const result = await acc(parser.transform(generator(), {}));
    expect(result[result.length - 1]).toEqual(EXPECTED_JSON_ESCAPED_QUOTES);
    await expect(parser.parse(test_case)).resolves.toEqual(
      EXPECTED_JSON_ESCAPED_QUOTES
    );
  });
}

describe("JsonOutputParser with ContentBlock messages", () => {
  test("should parse AIMessage with ContentBlock[] content", async () => {
    // This is the format returned by Gemini when using native JSON schema mode
    // The content is an array of ContentBlocks, not a plain string
    const parser = new JsonOutputParser();

    const message = new AIMessage({
      content: [
        {
          type: "text" as const,
          text: '{"conclusion": true, "reason": "test passed"}',
        },
      ],
    });

    const result = await parser.invoke(message);
    expect(result).toEqual({
      conclusion: true,
      reason: "test passed",
    });
  });

  test("should handle multiple text ContentBlocks", async () => {
    const parser = new JsonOutputParser();

    // Edge case: multiple text blocks that together form valid JSON
    // This shouldn't happen in practice, but the parser should handle it
    const message = new AIMessage({
      content: [
        {
          type: "text" as const,
          text: '{"foo": "bar"',
        },
        {
          type: "text" as const,
          text: ', "baz": 123}',
        },
      ],
    });

    const result = await parser.invoke(message);
    expect(result).toEqual({
      foo: "bar",
      baz: 123,
    });
  });

  test("should handle ContentBlocks with non-text types gracefully", async () => {
    const parser = new JsonOutputParser();

    // If there's a non-text block mixed in, it should be ignored
    const message = new AIMessage({
      content: [
        {
          type: "image_url" as const,
          image_url: "https://example.com/image.png",
        },
        {
          type: "text" as const,
          text: '{"answer": 42}',
        },
      ],
    });

    const result = await parser.invoke(message);
    expect(result).toEqual({ answer: 42 });
  });

  test("should still work with string content", async () => {
    const parser = new JsonOutputParser();

    // String content should still work as before
    const message = new AIMessage({
      content: '{"simple": "string"}',
    });

    const result = await parser.invoke(message);
    expect(result).toEqual({ simple: "string" });
  });
});
