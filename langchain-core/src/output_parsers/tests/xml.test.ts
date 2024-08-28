import { test, expect } from "@jest/globals";
import { FakeStreamingLLM } from "../../utils/testing/index.js";
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
    console.log(chunk);
    finalResult = chunk;
  }
  expect(finalResult).toStrictEqual(expectedResult);
});
