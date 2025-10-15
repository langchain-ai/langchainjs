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

const parser = new XMLOutputParser();

const result = await parser.invoke(XML_EXAMPLE);

console.log(JSON.stringify(result, null, 2));
/*
{
  "userProfile": [
    {
      "userID": "12345"
    },
    {
      "name": "John Doe"
    },
    {
      "email": "john.doe@example.com"
    },
    {
      "roles": [
        {
          "role": "Admin"
        },
        {
          "role": "User"
        }
      ]
    },
    {
      "preferences": [
        {
          "theme": "Dark"
        },
        {
          "notifications": [
            {
              "email": "true"
            },
            {
              "sms": "false"
            }
          ]
        }
      ]
    }
  ]
}
*/
