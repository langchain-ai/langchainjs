import { StructuredOutputParser } from "../structured.js";
import { z } from "zod";

test("parses multiline strings inside JSON correctly", async () => {
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({
      url: z.string(),
      summary: z.string(),
    })
  );

  const input = `\`\`\`json
{
  "url": "value",
  "summary": "line1,
line2,
line3"
}
\`\`\``;

  const result = await parser.parse(input);

  expect(result.summary).toBe("line1,\nline2,\nline3");
});
