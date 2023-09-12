/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as fs from "node:fs";
import * as url from "node:url";
import * as path from "node:path";
import { test } from "@jest/globals";
import { NotionAPILoader, PageObjectResponse } from "../web/notionapi.js";

test("Properties Parser", async () => {
  const loader = new NotionAPILoader({
    clientOptions: {
      auth: process.env.NOTION_INTEGRATION_TOKEN,
    },
    id: process.env.NOTION_PAGE_ID ?? "",
    onDocumentLoaded: (current, total, currentTitle) => {
      console.log(`Loaded Page: ${currentTitle} (${current}/${total})`);
    },
  });

  const filePath = path.resolve(
    path.dirname(url.fileURLToPath(import.meta.url)),
    "./example_data/notion_api/notion_page_response.json"
  );

  const pageDetails: PageObjectResponse = JSON.parse(
    fs.readFileSync(filePath).toString()
  );

  // Accessing private class method
  // eslint-disable-next-line dot-notation
  const contents = loader["parsePageProperties"](pageDetails);

  expect(contents.File).toBe('["MetaLumna Logo Square.png"]');
  expect(contents.Number).toBe("1234");
  expect(contents.Rollup).toBe("Unsupported type: rollup");
  expect(contents.Status).toBe("In progress");
  expect(contents["Multi-select"]).toBe('["Red", "Green", "Blue"]');
  expect(contents.Select).toBe("Magenta");
  expect(contents["Last edited time"]).toBe("2023-08-09T16:06:00.000Z");
  expect(contents.Text).toBe(
    "This is just some **text** with some formatting and new lines.\n" +
      "\n" +
      "_italic_\n" +
      "**bold**\n" +
      "`inline code`\n" +
      "~~strike through~~"
  );
  expect(contents["Last edited by"]).toBe(
    '["user", "c9b34ba3-5b62-4aa9-aae2-ed6024ffb0fd"]'
  );
  expect(contents["Related Example Database"]).toBe(
    '["7d9d1b96-34fa-4da3-b70d-9f71a75e1291", "7a1c25f2-d8a7-46d9-a2da-c9e39e018a56", "67662914-f22b-47fd-98aa-19988c40c77d"]'
  );
  expect(contents["Created by"]).toBe(
    '["user", "c9b34ba3-5b62-4aa9-aae2-ed6024ffb0fd"]'
  );
  expect(contents.Checkbox).toBe("true");
  expect(contents.Formula).toBe("Unsupported type: formula");
  expect(contents.Phone).toBe("555-1234");
  expect(contents.Email).toBe("skarard@gmail.com");
  expect(contents.URL).toBe("https://example.com");
  expect(contents["Created time"]).toBe("2023-06-14T10:29:00.000Z");
  expect(contents.ID).toBe("2");
  expect(contents.Date).toBe(
    "2023-08-09T00:00:00.000+01:00 - 2023-08-09T00:00:00.000+01:00"
  );
  expect(contents.Person).toBe(
    '[["user", "c9b34ba3-5b62-4aa9-aae2-ed6024ffb0fd"], ["user", "9d6b0c60-efdd-48d1-b63e-027d9b7d66a0"]]'
  );
  expect(contents.Name).toBe("An example page in a database");
  expect(contents._title).toBe("An example page in a database");
});
