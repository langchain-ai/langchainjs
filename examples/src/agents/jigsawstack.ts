import { ChatOpenAI } from "@langchain/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import {
  JigsawStackAIScrape,
  JigsawStackAISearch,
  JigsawStackVOCR,
  JigsawStackSpeechToText,
  JigsawStackTextToSQL,
} from "@langchain/jigsawstack";

const model = new ChatOpenAI({
  temperature: 0,
});

//  add the tools that you need
const tools = [
  new JigsawStackAIScrape(),
  new JigsawStackAISearch(),
  new JigsawStackVOCR(),
  new JigsawStackSpeechToText(),
  new JigsawStackTextToSQL(),
];

const executor = await initializeAgentExecutorWithOptions(tools, model, {
  agentType: "zero-shot-react-description",
  verbose: true,
});

const res = await executor.invoke({
  input: `Kokkalo Restaurant Santorini`,
});

console.log(res.output);

/*
{
  "query": "Kokkalo Restaurant Santorini",
  "ai_overview": "Kokkalo Restaurant, located in Fira, Santorini, offers a unique dining experience that blends traditional Greek cuisine with modern culinary trends. Here are some key details about the restaurant:\n\n- **Location**: Situated on the main road of Firostefani, Kokkalo is surrounded by the picturesque Cycladic architecture and provides stunning views of the Aegean Sea.\n- **Cuisine**: The restaurant specializes in authentic Greek dishes, crafted from high-quality, locally sourced ingredients. The menu is designed to engage all senses and features a variety of Mediterranean flavors.\n- **Ambiance**: Kokkalo boasts a chic and modern décor, creating a welcoming atmosphere for guests. The staff is known for their professionalism and attentiveness, enhancing the overall dining experience.\n- **Culinary Experience**: The name \"Kokkalo,\" meaning \"bone\" in Greek, symbolizes the strong foundation of the restaurant's culinary philosophy. Guests can expect a bold and unforgettable culinary journey.\n- **Cooking Classes**: Kokkalo also offers cooking lessons, allowing visitors to learn how to prepare traditional Greek dishes, providing a unique souvenir of their time in Santorini.\n- **Contact Information**: \n  - Address: 25 Martiou str, Fira, Santorini 84 700, Cyclades, Greece\n  - Phone: +30 22860 25407\n  - Email: reservation@kokkalosantorini.com\n\nFor more information, you can visit their [official website](https://www.santorini-view.com/restaurants/kokkalo-restaurant/) or their [Facebook page](https://www.facebook.com/kokkalorestaurant/).",
  "is_safe": true,
  "results": [
    {
      "title": "Kokkalo restaurant, Restaurants in Firostefani Santorini Greece",
      "url": "http://www.travel-to-santorini.com/restaurants/firostefani/thebonerestaurant/",
      "description": "Details Contact : George Grafakos Address : Firostefani, Opposite of Fira Primary School Zipcode : 84700 City : Santorni Phone : +30 22860 25407 Send an email",
      "content": null,
      "site_name": "Travel-to-santorini",
      "site_long_name": "travel-to-santorini.com",
      "language": "en",
      "is_safe": true,
      "favicon": "https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://travel-to-santorini.com&size=96"
    }
  ]
}
*/
