import { ChatCohere } from "@langchain/cohere";
import { HumanMessage } from "langchain/schema";

const model = new ChatCohere({
  apiKey: process.env.COHERE_API_KEY, // Default
  model: "command", // Default
});

const response = await model.invoke(
  [new HumanMessage("How tall are the largest pengiuns?")],
  {
    connectors: [{ id: "web-search" }],
  }
);
console.log("response: ", JSON.stringify(response, null, 2));
/**
response:  {
  "lc": 1,
  "type": "constructor",
  "id": [
    "langchain_core",
    "messages",
    "AIMessage"
  ],
  "kwargs": {
    "content": "The tallest penguin species currently in existence is the Emperor Penguin, with a height of 110cm to the top of their head or 115cm to the tip of their beak. This is equivalent to being approximately 3 feet and 7 inches tall.\n\nA fossil of an Anthropornis penguin was found in New Zealand and is suspected to have been even taller at 1.7 metres, though this is uncertain as the fossil is only known from preserved arm and leg bones. The height of a closely related species, Kumimanu biceae, has been estimated at 1.77 metres.\n\nDid you know that because larger-bodied penguins can hold their breath for longer, the colossus penguin could have stayed underwater for 40 minutes or more?",
    "additional_kwargs": {
      "response_id": "a3567a59-2377-439d-894f-0309f7fea1de",
      "generationId": "65dc5b1b-6099-44c4-8338-50eed0d427c5",
      "token_count": {
        "prompt_tokens": 1394,
        "response_tokens": 149,
        "total_tokens": 1543,
        "billed_tokens": 159
      },
      "meta": {
        "api_version": {
          "version": "1"
        },
        "billed_units": {
          "input_tokens": 10,
          "output_tokens": 149
        }
      },
      "citations": [
        {
          "start": 58,
          "end": 73,
          "text": "Emperor Penguin",
          "documentIds": [
            "web-search_3:2",
            "web-search_4:10"
          ]
        },
        {
          "start": 92,
          "end": 157,
          "text": "110cm to the top of their head or 115cm to the tip of their beak.",
          "documentIds": [
            "web-search_4:10"
          ]
        },
        {
          "start": 200,
          "end": 225,
          "text": "3 feet and 7 inches tall.",
          "documentIds": [
            "web-search_3:2",
            "web-search_4:10"
          ]
        },
        {
          "start": 242,
          "end": 262,
          "text": "Anthropornis penguin",
          "documentIds": [
            "web-search_9:4"
          ]
        },
        {
          "start": 276,
          "end": 287,
          "text": "New Zealand",
          "documentIds": [
            "web-search_9:4"
          ]
        },
        {
          "start": 333,
          "end": 343,
          "text": "1.7 metres",
          "documentIds": [
            "web-search_9:4"
          ]
        },
        {
          "start": 403,
          "end": 431,
          "text": "preserved arm and leg bones.",
          "documentIds": [
            "web-search_9:4"
          ]
        },
        {
          "start": 473,
          "end": 488,
          "text": "Kumimanu biceae",
          "documentIds": [
            "web-search_9:4"
          ]
        },
        {
          "start": 512,
          "end": 524,
          "text": "1.77 metres.",
          "documentIds": [
            "web-search_9:4"
          ]
        },
        {
          "start": 613,
          "end": 629,
          "text": "colossus penguin",
          "documentIds": [
            "web-search_3:2"
          ]
        },
        {
          "start": 663,
          "end": 681,
          "text": "40 minutes or more",
          "documentIds": [
            "web-search_3:2"
          ]
        }
      ],
      "documents": [
        {
          "id": "web-search_3:2",
          "snippet": " By comparison, the largest species of penguin alive today, the emperor penguin, is \"only\" about 4 feet tall and can weigh as much as 100 pounds.\n\nInterestingly, because larger bodied penguins can hold their breath for longer, the colossus penguin probably could have stayed underwater for 40 minutes or more. It boggles the mind to imagine the kinds of huge, deep sea fish this mammoth bird might have been capable of hunting.\n\nThe fossil was found at the La Meseta formation on Seymour Island, an island in a chain of 16 major islands around the tip of the Graham Land on the Antarctic Peninsula.",
          "title": "Giant 6-Foot-8 Penguin Discovered in Antarctica",
          "url": "https://www.treehugger.com/giant-foot-penguin-discovered-in-antarctica-4864169"
        },
        {
          "id": "web-search_4:10",
          "snippet": "\n\nWhat is the Tallest Penguin?\n\nThe tallest penguin is the Emperor Penguin which is 110cm to the top of their head or 115cm to the tip of their beak.\n\nHow Tall Are Emperor Penguins in Feet?\n\nAn Emperor Penguin is about 3 feet and 7 inches to the top of its head. They are the largest penguin species currently in existence.\n\nHow Much Do Penguins Weigh in Pounds?\n\nPenguins weigh between 2.5lbs for the smallest species, the Little Penguin, up to 82lbs for the largest species, the Emperor Penguin.\n\nDr. Jackie Symmons is a professional ecologist with a Ph.D. in Ecology and Wildlife Management from Bangor University and over 25 years of experience delivering conservation projects.",
          "title": "How Big Are Penguins? [Height & Weight of Every Species] - Polar Guidebook",
          "url": "https://polarguidebook.com/how-big-are-penguins/"
        },
        {
          "id": "web-search_9:4",
          "snippet": "\n\nA fossil of an Anthropornis penguin found on the island may have been even taller, but this is likely to be an exception. The majority of these penguins were only 1.7 metres tall and weighed around 80 kilogrammes.\n\nWhile Palaeeudyptes klekowskii remains the tallest ever penguin, it is no longer the heaviest. At an estimated 150 kilogrammes, Kumimanu fordycei would have been around three times heavier than any living penguin.\n\nWhile it's uncertain how tall the species was, the height of a closely related species, Kumimanu biceae, has been estimated at 1.77 metres.\n\nThese measurements, however, are all open for debate. Many fossil penguins are only known from preserved arm and leg bones, rather than complete skeletons.",
          "title": "The largest ever penguin species has been discovered in New Zealand | Natural History Museum",
          "url": "https://www.nhm.ac.uk/discover/news/2023/february/largest-ever-penguin-species-discovered-new-zealand.html"
        }
      ],
      "searchResults": [
        {
          "searchQuery": {
            "text": "largest penguin species height",
            "generationId": "908fe321-5d27-48c4-bdb6-493be5687344"
          },
          "documentIds": [
            "web-search_3:2",
            "web-search_4:10",
            "web-search_9:4"
          ],
          "connector": {
            "id": "web-search"
          }
        }
      ],
      "tool_inputs": null,
      "searchQueries": [
        {
          "text": "largest penguin species height",
          "generationId": "908fe321-5d27-48c4-bdb6-493be5687344"
        }
      ]
    }
  }
}
 */
