import { XMLOutputParser } from "@langchain/core/output_parsers";
import { FakeStreamingLLM } from "@langchain/core/utils/testing";

const XML_EXAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<userProfile>
  <userID>12345</userID>
  <roles>
    <role>Admin</role>
    <role>User</role>
  </roles>
</userProfile>`;

const parser = new XMLOutputParser();

// Define your LLM, in this example we'll use demo streaming LLM
const streamingLLM = new FakeStreamingLLM({
  responses: [XML_EXAMPLE],
}).pipe(parser); // Pipe the parser to the LLM

const stream = await streamingLLM.stream(XML_EXAMPLE);
for await (const chunk of stream) {
  console.log(JSON.stringify(chunk, null, 2));
}
/*
{}
{
  "userProfile": ""
}
{
  "userProfile": "\n"
}
{
  "userProfile": [
    {
      "userID": ""
    }
  ]
}
{
  "userProfile": [
    {
      "userID": "123"
    }
  ]
}
{
  "userProfile": [
    {
      "userID": "12345"
    },
    {
      "roles": ""
    }
  ]
}
{
  "userProfile": [
    {
      "userID": "12345"
    },
    {
      "roles": [
        {
          "role": "A"
        }
      ]
    }
  ]
}
{
  "userProfile": [
    {
      "userID": "12345"
    },
    {
      "roles": [
        {
          "role": "Admi"
        }
      ]
    }
  ]
}
{
  "userProfile": [
    {
      "userID": "12345"
    },
    {
      "roles": [
        {
          "role": "Admin"
        },
        {
          "role": "U"
        }
      ]
    }
  ]
}
{
  "userProfile": [
    {
      "userID": "12345"
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
    }
  ]
}
*/
