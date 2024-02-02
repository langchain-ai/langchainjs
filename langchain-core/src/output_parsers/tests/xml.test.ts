import { XMLOutputParser } from "../xml.js";

const XML_EXAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<userProfile>
  <userID>12345</userID>
  <name>John Doe</name>
  <email>john.doe@example.com</email>
  <roles>
    <role>Admin</role>
    <role>User</role>
  </roles>
  <preferences>
    <theme>Dark</theme>
    <notifications>
      <email>true</email>
      <sms>false</sms>
    </notifications>
  </preferences>
</userProfile>`;

const BACKTICK_WRAPPED_XML = `\`\`\`xml\n${XML_EXAMPLE}\n\`\`\``;

type MySchema = {
  userProfile: {
    userID: number;
    name: string;
    email: string;
    roles: { role: string[] };
    preferences: {
      theme: string;
      notifications: {
        email: boolean;
        sms: boolean;
      };
    };
  };
};

const expectedResult = {
  userProfile: {
    userID: 12345,
    name: "John Doe",
    email: "john.doe@example.com",
    roles: { role: ["Admin", "User"] },
    preferences: {
      theme: "Dark",
      notifications: {
        email: true,
        sms: false,
      },
    },
  },
};

test("Can parse XML", async () => {
  const parser = new XMLOutputParser<MySchema>();

  const result = await parser.invoke(XML_EXAMPLE);
  expect(result).toBe(expectedResult);
});

test("Can parse backtick wrapped XML", async () => {
  const parser = new XMLOutputParser<MySchema>();

  const result = await parser.invoke(BACKTICK_WRAPPED_XML);
  expect(result).toBe(expectedResult);
});
