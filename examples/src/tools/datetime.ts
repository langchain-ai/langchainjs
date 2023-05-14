import { DateTimeTool } from "langchain/tools/datetime";

export async function run() {
  const dateTimeTool = new DateTimeTool();

  const result = await dateTimeTool.call({});

  console.log(result);
  /*
  Current date time is Sun, 14 May 2023 09:54:18 GMT
  */
}
