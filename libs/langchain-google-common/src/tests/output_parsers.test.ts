/* eslint-disable @typescript-eslint/no-explicit-any */
import {test} from "@jest/globals";
import {MockClientAuthInfo, mockId} from "./mock.js";
import {ChatGoogle} from "./chat_models.test.js";
import {SimpleGoogleSearchOutputParser} from "../output_parsers.js";

describe("GoogleSearchOutputParsers", () => {

  test("Simple", async () => {
    const record: Record<string, any> = {};
    const projectId = mockId();
    const authOptions: MockClientAuthInfo = {
      record,
      projectId,
      resultFile: "chat-6-mock.json",
    };

    const searchRetrievalTool = {
      googleSearchRetrieval: {
        dynamicRetrievalConfig: {
          mode: "MODE_DYNAMIC",
          dynamicThreshold: 0.7, // default is 0.7
        },
      },
    };
    const model = new ChatGoogle({
      authOptions,
      modelName: "gemini-1.5-pro-002",
      temperature: 0,
      maxRetries: 0,
    }).bindTools([searchRetrievalTool]);

    const parser = new SimpleGoogleSearchOutputParser();

    const chain = model.pipe(parser);

    const result = await chain.invoke("Who won the 2024 MLB World Series?");

    const expectation = "Google Says:\n" +
      "The Los Angeles Dodgers won the 2024 World Series, defeating the New York Yankees 4-1 in the series. [1]  The Dodgers clinched the title with a 7-6 comeback victory in Game 5 at Yankee Stadium on Wednesday, October 30th. This was their eighth World Series title overall and their second in the past five years.  It was also their first World Series win in a full season since 1988. [2]  Mookie Betts earned his third World Series ring (2018, 2020, and 2024), becoming the only active player with three championships. [3]  Shohei Ohtani, in his first year with the Dodgers, also experienced his first post-season appearance. [1]\n" +
      "\n" +
      "1. bbc.com - https://vertexaisearch.cloud.google.com/grounding-api-redirect/AYygrcTYmdnM71OvWYUTG4JggmRj8cIIgA2KtKas5RPj09CiALB4n8hl-SfCD6r8WnimL2psBoYmEN9ng9sENjpeP5VxgLMTlm0zgxhrWFfx3yA6B_n0N9j-BgHLISAUi-_Ql4_Buyw68Svq-3v6BgrXzn9hLOtK\n" +
      "2. mlb.com - https://vertexaisearch.cloud.google.com/grounding-api-redirect/AYygrcQRhhvHTdpb8OMOEMVxv9fkevPoMWMnhrpuC7E0E0R94xmFxT9Vv5na1hMrfHGKxVZ9aE3PgCAs5nftC3iAkeD7B6ZTfKGH2Im1CqssMM7zorGx1Ds5_7QPPBDQps_JvpkOuvRluGCVg8KwNaIU-hm3Kg==\n" +
      "3. youtube.com - https://vertexaisearch.cloud.google.com/grounding-api-redirect/AYygrcSwvb2t622A2ZpKxqOWKy16L1mEUvmsAJoHjaR7uffKO71SeZkpdRXRsST9HJzJkGSkMF9kOaXGoDtcvUrttqKYOQHvHSUBYO7LWMlU00KyNlSoQzrBsgN4KuJ4O4acnNyNCSVX3-E=\n";

    expect(result).toEqual(expectation);
  });

});