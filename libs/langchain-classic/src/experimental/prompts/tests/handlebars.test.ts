import { HandlebarsPromptTemplate } from "../handlebars.js";

describe.each([
  ["{{foo}}", { foo: "bar" }, "bar"],
  ["pre{{foo}}post", { foo: "bar" }, "prebarpost"],
  ["{{{foo}}}", { foo: "bar" }, "bar"],
  ["text", {}, "text"],
  ["}}", {}, "}}"],
  ["{{first}}_{{second}}", { first: "foo", second: "bar" }, "foo_bar"],
])("Valid handlebars", (template, variables, result) => {
  test(`Interpolation works: ${template}`, async () => {
    const prompt = HandlebarsPromptTemplate.fromTemplate(template);
    const invokeResult = await prompt.invoke(variables);
    expect(invokeResult.value).toBe(result);
  });
});

describe.each([
  ["}}{{", {}],
  ["{{", {}],
  ["{{foo", {}],
])("Invalid handlebars", (template) => {
  test(`Interpolation throws: ${template}`, async () => {
    expect(() =>
      HandlebarsPromptTemplate.fromTemplate(template)
    ).toThrowError();
  });
});
