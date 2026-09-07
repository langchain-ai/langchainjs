import { test, expect } from "vitest";
import mustache from "mustache";
import { PromptTemplate } from "../prompt.js";
import { interpolateMustache, parseMustache } from "../template.js";

const VALUE_WITH_HTML_CHARS = "1 < 2 & 3 > 2";
const HTML_ESCAPED_VALUE = "1 &lt; 2 &amp; 3 &gt; 2";

test("formatting a mustache prompt template leaves mustache's defaults intact for other callers", async () => {
  expect(
    mustache.render("Hello {{name}}!", { name: VALUE_WITH_HTML_CHARS })
  ).toBe(`Hello ${HTML_ESCAPED_VALUE}!`);

  const prompt = PromptTemplate.fromTemplate("Answer: {{question}}", {
    templateFormat: "mustache",
  });
  await prompt.format({ question: "test" });

  expect(
    mustache.render("Hello {{name}}!", { name: VALUE_WITH_HTML_CHARS })
  ).toBe(`Hello ${HTML_ESCAPED_VALUE}!`);
});

test("mustache templates render prompt values without HTML escaping", async () => {
  expect(
    interpolateMustache("Hello {{name}}!", { name: VALUE_WITH_HTML_CHARS })
  ).toBe(`Hello ${VALUE_WITH_HTML_CHARS}!`);

  const prompt = PromptTemplate.fromTemplate("Hello {{name}}!", {
    templateFormat: "mustache",
  });
  expect(await prompt.format({ name: VALUE_WITH_HTML_CHARS })).toBe(
    `Hello ${VALUE_WITH_HTML_CHARS}!`
  );
});

test("parsing a mustache template leaves mustache's defaults intact for other callers", () => {
  parseMustache("Answer: {{question}}");

  expect(
    mustache.render("Hello {{name}}!", { name: VALUE_WITH_HTML_CHARS })
  ).toBe(`Hello ${HTML_ESCAPED_VALUE}!`);
});
