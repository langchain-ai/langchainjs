import { XMLOutputParser } from "@langchain/core/output_parsers";

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

// Pass in a generic type for the schema
const parser = new XMLOutputParser<MySchema>();

const result = await parser.invoke(XML_EXAMPLE);

console.log(result);

/*

*/
