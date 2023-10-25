import { ReActSingleInputOutputParser } from "../react/output_parser.js";

test("ReActSingleInputOutputParser identifies final answer", async () => {
  const finalAnswerText = `Observation: 2.169459462491557
  Thought: I now know the final answer
  Final Answer: Harry Styles, Olivia Wilde's boyfriend, is 29 years old and his age raised to the 0.23 power is 2.169459462491557.`;
  const outputParser = new ReActSingleInputOutputParser({
    toolNames: [],
  });

  const parsedOutput = await outputParser.parse(finalAnswerText);
  console.log(parsedOutput);
  expect(parsedOutput).toHaveProperty("returnValues");
  expect(
    "returnValues" in parsedOutput && parsedOutput.returnValues.output
  ).toEqual(
    "Harry Styles, Olivia Wilde's boyfriend, is 29 years old and his age raised to the 0.23 power is 2.169459462491557."
  );
});

test("ReActSingleInputOutputParser identifies agent actions", async () => {
  const finalAnswerText = `Observation: 29 years
  Thought: I need to calculate 29 raised to the 0.23 power
  Action: calculator
  Action Input: 29^0.23`;
  const outputParser = new ReActSingleInputOutputParser({
    toolNames: [],
  });

  const parsedOutput = await outputParser.parse(finalAnswerText);
  console.log(parsedOutput);
  expect(parsedOutput).toHaveProperty("toolInput");
  expect(parsedOutput).toHaveProperty("tool");
});

test("ReActSingleInputOutputParser throws if no agent finish/action is passed", async () => {
  const finalAnswerText = `Who is Harry Styles' girlfriend?`;
  const outputParser = new ReActSingleInputOutputParser({
    toolNames: [],
  });

  await expect(outputParser.parse(finalAnswerText)).rejects.toThrow();
});

test("ReActSingleInputOutputParser throws if agent finish and action are passed", async () => {
  const finalAnswerText = `Observation: 29 years
  Thought: I need to calculate 29 raised to the 0.23 power
  Action: calculator
  Action Input: 29^0.23
  Final Answer: Harry Styles, Olivia Wilde's boyfriend, is 29 years old and his age raised to the 0.23 power is 2.169459462491557.`;
  const outputParser = new ReActSingleInputOutputParser({
    toolNames: [],
  });

  await expect(outputParser.parse(finalAnswerText)).rejects.toThrow();
});
