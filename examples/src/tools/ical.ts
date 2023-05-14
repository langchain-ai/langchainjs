import { ICalTool } from "langchain/tools/ical";
import { OpenAIChat } from "langchain/llms/openai";
import { NodeFileStore } from "langchain/stores/file/node";

export async function run() {
  const outputDir = "./output/events";

  const iCalTool = new ICalTool({
    store: new NodeFileStore(outputDir),
    llm: new OpenAIChat({ temperature: 0 }),
  });

  const result = await iCalTool.call(
    "Create a 1 week running plan starting on May 10, 2023 to prepare for 10k run."
  );

  console.log(result);
  /*
  A 1 week running plan to prepare for a 10k run event created successfully and saved as 10k Run.ics.
  */
}
