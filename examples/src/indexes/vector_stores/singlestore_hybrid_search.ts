import { SingleStoreVectorStore } from "@langchain/community/vectorstores/singlestore";
import { OpenAIEmbeddings } from "@langchain/openai";

export const run = async () => {
  const vectorStore = await SingleStoreVectorStore.fromTexts(
    [
      "In the parched desert, a sudden rainstorm brought relief, as the droplets danced upon the thirsty earth, rejuvenating the landscape with the sweet scent of petrichor.",
      "Amidst the bustling cityscape, the rain fell relentlessly, creating a symphony of pitter-patter on the pavement, while umbrellas bloomed like colorful flowers in a sea of gray.",
      "High in the mountains, the rain transformed into a delicate mist, enveloping the peaks in a mystical veil, where each droplet seemed to whisper secrets to the ancient rocks below.",
      "Blanketing the countryside in a soft, pristine layer, the snowfall painted a serene tableau, muffling the world in a tranquil hush as delicate flakes settled upon the branches of trees like nature's own lacework.",
      "In the urban landscape, snow descended, transforming bustling streets into a winter wonderland, where the laughter of children echoed amidst the flurry of snowballs and the twinkle of holiday lights.",
      "Atop the rugged peaks, snow fell with an unyielding intensity, sculpting the landscape into a pristine alpine paradise, where the frozen crystals shimmered under the moonlight, casting a spell of enchantment over the wilderness below.",
    ],
    [
      { category: "rain" },
      { category: "rain" },
      { category: "rain" },
      { category: "snow" },
      { category: "snow" },
      { category: "snow" },
    ],
    new OpenAIEmbeddings(),
    {
      connectionOptions: {
        host: process.env.SINGLESTORE_HOST,
        port: Number(process.env.SINGLESTORE_PORT),
        user: process.env.SINGLESTORE_USERNAME,
        password: process.env.SINGLESTORE_PASSWORD,
        database: process.env.SINGLESTORE_DATABASE,
      },
      distanceMetric: "DOT_PRODUCT",
      useVectorIndex: true,
      useFullTextIndex: true,
    }
  );

  const resultOne = await vectorStore.similaritySearch(
    "rainstorm in parched desert, rain",
    1,
    { category: "rain" }
  );
  console.log(resultOne[0].pageContent);

  await vectorStore.setSearchConfig({
    searchStrategy: "TEXT_ONLY",
  });
  const resultTwo = await vectorStore.similaritySearch(
    "rainstorm in parched desert, rain",
    1
  );
  console.log(resultTwo[0].pageContent);

  await vectorStore.setSearchConfig({
    searchStrategy: "FILTER_BY_TEXT",
    filterThreshold: 0.1,
  });
  const resultThree = await vectorStore.similaritySearch(
    "rainstorm in parched desert, rain",
    1
  );
  console.log(resultThree[0].pageContent);

  await vectorStore.setSearchConfig({
    searchStrategy: "FILTER_BY_VECTOR",
    filterThreshold: 0.1,
  });
  const resultFour = await vectorStore.similaritySearch(
    "rainstorm in parched desert, rain",
    1
  );
  console.log(resultFour[0].pageContent);

  await vectorStore.setSearchConfig({
    searchStrategy: "WEIGHTED_SUM",
    textWeight: 0.2,
    vectorWeight: 0.8,
    vectorselectCountMultiplier: 10,
  });
  const resultFive = await vectorStore.similaritySearch(
    "rainstorm in parched desert, rain",
    1
  );
  console.log(resultFive[0].pageContent);

  await vectorStore.end();
};
