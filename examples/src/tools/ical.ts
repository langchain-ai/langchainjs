import { ICalTool } from "langchain/tools/ical";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { NodeFileStore } from 'langchain/stores/file/node';

export async function run() {
  const outputDir = './output/events';

  const iCalTool = new ICalTool({
    store: new NodeFileStore(outputDir),
    llm:  new ChatOpenAI({ temperature: 0 }),
  });

  const result = await iCalTool.call(
    'Create a 1 week running plan starting on May 10, 2023 to prepare for 10k run.'
  );

  console.log(result);
  /*
  10k Run Preparation Plan.ics created successfully
  */
}
