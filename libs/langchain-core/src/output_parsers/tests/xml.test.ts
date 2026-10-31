import { test, expect } from "vitest";
import { FakeStreamingLLM } from "../../utils/testing/index.js";
import { applyPatch, type Operation } from "../../utils/json_patch.js";
import { XMLOutputParser } from "../xml.js";

const XML_EXAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<userProfile>
  <userID>12345</userID>
  <email>john.doe@example.com</email>
  <roles>
    <role>Admin</role>
    <role>User</role>
  </roles>
  <preferences>
    <theme>Dark</theme>
    <notifications>
      <email>true</email>
    </notifications>
  </preferences>
</userProfile>`;

const BACKTICK_WRAPPED_XML = `\`\`\`xml\n${XML_EXAMPLE}\n\`\`\``;

const expectedResult = {
  userProfile: [
    {
      userID: "12345",
    },
    {
      email: "john.doe@example.com",
    },
    {
      roles: [
        {
          role: "Admin",
        },
        {
          role: "User",
        },
      ],
    },
    {
      preferences: [
        {
          theme: "Dark",
        },
        {
          notifications: [
            {
              email: "true",
            },
          ],
        },
      ],
    },
  ],
};

test("Can parse XML", async () => {
  const parser = new XMLOutputParser();

  const result = await parser.invoke(XML_EXAMPLE);
  expect(result).toStrictEqual(expectedResult);
});

test("Can parse backtick wrapped XML", async () => {
  const parser = new XMLOutputParser();

  const result = await parser.invoke(BACKTICK_WRAPPED_XML);
  expect(result).toStrictEqual(expectedResult);
});

test("Can format instructions with passed tags.", async () => {
  const tags = ["tag1", "tag2", "tag3"];
  const parser = new XMLOutputParser({ tags });

  const formatInstructions = parser.getFormatInstructions();

  expect(formatInstructions).toContain("tag1, tag2, tag3");
});

test("Can parse streams", async () => {
  const parser = new XMLOutputParser();
  const streamingLlm = new FakeStreamingLLM({
    responses: [XML_EXAMPLE],
  }).pipe(parser);

  const result = await streamingLlm.stream(XML_EXAMPLE);
  let finalResult = {};
  for await (const chunk of result) {
    finalResult = chunk;
  }
  expect(finalResult).toStrictEqual(expectedResult);
});

const SELF_CLOSING_XML = "<root><group><a/><b>x</b></group><c>y</c></root>";
const SELF_CLOSING_RESULT = {
  root: [{ group: [{ a: "" }, { b: "x" }] }, { c: "y" }],
};

test.each([
  { name: "root", xml: "<root/>", expected: { root: "" } },
  {
    name: "nested child before siblings",
    xml: SELF_CLOSING_XML,
    expected: SELF_CLOSING_RESULT,
  },
  {
    name: "consecutive empty siblings",
    xml: "<root><a/><b/><c>y</c></root>",
    expected: { root: [{ a: "" }, { b: "" }, { c: "y" }] },
  },
  {
    name: "last child before a parent's sibling",
    xml: "<root><group><value>x</value><empty/></group><tail>y</tail></root>",
    expected: {
      root: [{ group: [{ value: "x" }, { empty: "" }] }, { tail: "y" }],
    },
  },
  {
    name: "repeated element names",
    xml: "<root><item/><item>x</item><item/></root>",
    expected: { root: [{ item: "" }, { item: "x" }, { item: "" }] },
  },
  {
    name: "attributes and whitespace",
    xml: '<root><empty flag="yes" /><value>x</value></root>',
    expected: { root: [{ empty: "" }, { value: "x" }] },
  },
])(
  "preserves the XML tree with a self-closing $name",
  async ({ xml, expected }) => {
    const parser = new XMLOutputParser();
    expect(await parser.invoke(xml)).toStrictEqual(expected);
  }
);

test("parses self-closing and explicitly closed empty elements identically", async () => {
  const parser = new XMLOutputParser();
  const explicit = "<root><group><a></a><b>x</b></group><c>y</c></root>";
  expect(await parser.parse(SELF_CLOSING_XML)).toStrictEqual(
    await parser.parse(explicit)
  );
});

test.each(["xml", ""])(
  "preserves self-closing elements in a Markdown fence labeled '%s'",
  async (label) => {
    const parser = new XMLOutputParser();
    expect(
      await parser.parse(`\`\`\`${label}\n${SELF_CLOSING_XML}\n\`\`\``)
    ).toStrictEqual(SELF_CLOSING_RESULT);
  }
);

test("preserves self-closing elements in a partial result", async () => {
  const parser = new XMLOutputParser();
  expect(
    await parser.parsePartialResult([
      { text: "<root><group><a/><b>x</b></group><c>y" },
    ])
  ).toStrictEqual(SELF_CLOSING_RESULT);
});

test.each([false, true])(
  "preserves self-closing elements in streamed output with diff=%s",
  async (diff) => {
    const parser = new XMLOutputParser({ diff });
    const stream = await new FakeStreamingLLM({
      responses: [SELF_CLOSING_XML],
      sleep: 0,
    })
      .pipe(parser)
      .stream(SELF_CLOSING_XML);

    let finalResult: unknown = {};
    for await (const chunk of stream) {
      finalResult = diff
        ? applyPatch(finalResult, chunk as unknown as Operation[]).newDocument
        : chunk;
    }
    expect(finalResult).toStrictEqual(SELF_CLOSING_RESULT);
  }
);
