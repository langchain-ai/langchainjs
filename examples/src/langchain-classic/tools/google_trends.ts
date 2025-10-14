import { SERPGoogleTrendsTool } from "@langchain/community/tools/google_trends";

export async function run() {
  const tool = new SERPGoogleTrendsTool();

  const res = await tool.invoke("Monster");

  console.log(res);
}
