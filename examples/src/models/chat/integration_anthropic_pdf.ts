import { ChatAnthropic } from "@langchain/anthropic";

import * as fs from "fs";

export const run = async () => {
  const llm = new ChatAnthropic({
    model: "claude-3-5-sonnet-20240620", // Only claude-3-5-sonnet-20240620 , claude-3-5-sonnet-20241022 as of Jan 2025 support PDF documents as in base64
  });

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

  const prompt = "Summarise the contents of this PDF";

  const response = await llm.invoke([
    {
      role: "user",
      content: [
        {
          type: "text",
          text: prompt,
        },
        {
          type: "document",
          source: {
            media_type: "application/pdf",
            type: "base64",
            data: base64,
          },
        },
      ],
    },
  ]);
  console.log(response.content);
  return response.content;
};
