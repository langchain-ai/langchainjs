import { HumanMessage } from "@langchain/core/message";
import { ChatAnthropic } from "@langchain/anthropic";

export const run = async () => {
  const llm = new ChatAnthropic({
    model: "claude-3-5-sonnet-20240620", // Only claude-3-5-sonnet-20240620 or later supports documents
  });

  const prompt = "Summarise the contents of this PDF";

  // PDF needs to be in Base64.
  const getLocalFile = async (path: string) => {
    const localFile = await fs.readFileSync(path);
    const base64File = localFile.toString("base64");
    return base64File;
  };
  // Or remotely
  const getRemoteFile = async (url: string) => {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const base64File = Buffer.from(arrayBuffer).toString("base64");
    return base64File;
  };

  const base64 = await getRemoteFile(
    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
  );

  const response = await llm.invoke(
    new HumanMessage({
      content: [
        {
          type: "text",
          text: prompt,
        },
        {
          type: "document",
          source: base64,
        },
      ],
    })
  );
  console.log(response.content);
  //console.log(response.content);
  return response.content;
};
