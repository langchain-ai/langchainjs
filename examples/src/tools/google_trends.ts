import { GoogleTrendsAPI } from "@langchain/community/tools/google_trends";

export async function run() {

  const tool = new GoogleTrendsAPI(); 

  const res = await tool.run("Monster");

  console.log(res);
}