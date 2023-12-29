import { JsonOutputParser } from "../json.js";

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

async function acc(iter: AsyncGenerator<object>): Promise<object[]> {
  const acc = [];
  for await (const chunk of iter) {
    acc.push(chunk);
  }
  return acc;
}

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

test("JSONOutputParser parses streamed JSON diff", async () => {
  async function* generator() {
    for (const token of STREAMED_TOKENS) {
      yield token;
    }
  }
  const parser = new JsonOutputParser({ diff: true });
  const result = await acc(parser.transform(generator(), {}));
  expect(result).toEqual(EXPECTED_STREAMED_JSON_DIFF);
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
  // eslint-disable-next-line no-loop-func
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
  // eslint-disable-next-line no-loop-func
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
