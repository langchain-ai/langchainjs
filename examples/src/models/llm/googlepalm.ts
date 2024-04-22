import { GooglePaLM } from "@langchain/community/llms/googlepalm";

export const run = async () => {
  const model = new GooglePaLM({
    apiKey: "<YOUR API KEY>", // or set it in environment variable as `GOOGLE_PALM_API_KEY`
    // other params
    temperature: 1, // OPTIONAL
    model: "models/text-bison-001", // OPTIONAL
    maxOutputTokens: 1024, // OPTIONAL
    topK: 40, // OPTIONAL
    topP: 3, // OPTIONAL
    safetySettings: [
      // OPTIONAL
      {
        category: "HARM_CATEGORY_DANGEROUS",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
    ],
    stopSequences: ["stop"], // OPTIONAL
  });
  const res = await model.invoke(
    "What would be a good company name for a company that makes colorful socks?"
  );
  console.log({ res });
};
