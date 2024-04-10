import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";

/*
 * Before running this, you should make sure you have created a
 * Google Cloud Project that has `generativelanguage` API enabled.
 *
 * You will also need to generate an API key and set
 * an environment variable GOOGLE_API_KEY
 *
 */

// Text
const model = new ChatGoogleGenerativeAI({
  modelName: "gemini-pro",
  maxOutputTokens: 2048,
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
    },
  ],
});

// Batch and stream are also supported
const res = await model.invoke([
  [
    "human",
    "What would be a good company name for a company that makes colorful socks?",
  ],
]);

console.log(res);

/*
  AIMessage {
    content: '1. Rainbow Soles\n' +
      '2. Toe-tally Colorful\n' +
      '3. Bright Sock Creations\n' +
      '4. Hue Knew Socks\n' +
      '5. The Happy Sock Factory\n' +
      '6. Color Pop Hosiery\n' +
      '7. Sock It to Me!\n' +
      '8. Mismatched Masterpieces\n' +
      '9. Threads of Joy\n' +
      '10. Funky Feet Emporium\n' +
      '11. Colorful Threads\n' +
      '12. Sole Mates\n' +
      '13. Colorful Soles\n' +
      '14. Sock Appeal\n' +
      '15. Happy Feet Unlimited\n' +
      '16. The Sock Stop\n' +
      '17. The Sock Drawer\n' +
      '18. Sole-diers\n' +
      '19. Footloose Footwear\n' +
      '20. Step into Color',
    name: 'model',
    additional_kwargs: {}
  }
*/
