import { GoogleTrendsAPI } from "@langchain/community/tools/google_trends";

export async function run() {
  const tool = new GoogleTrendsAPI();

  const res = await tool._call("Monster");

  console.log(res);
}
