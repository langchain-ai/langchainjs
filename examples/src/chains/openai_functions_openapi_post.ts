import { createOpenAPIChain } from "langchain/chains";

const chain = await createOpenAPIChain("https://api.speak.com/openapi.yaml");
const result = await chain.run(`How would you say no thanks in Russian?`);

console.log(JSON.stringify(result, null, 2));

/*
  {
    "explanation": "<translation language=\\"Russian\\" context=\\"\\">\\nНет, спасибо.\\n</translation>\\n\\n<alternatives context=\\"\\">\\n1. \\"Нет, не надо\\" *(Neutral/Formal - a polite way to decline something)*\\n2. \\"Ни в коем случае\\" *(Strongly informal - used when you want to emphasize that you absolutely do not want something)*\\n3. \\"Нет, благодарю\\" *(Slightly more formal - a polite way to decline something while expressing gratitude)*\\n</alternatives>\\n\\n<example-convo language=\\"Russian\\">\\n<context>Mike offers Anna some cake, but she doesn't want any.</context>\\n* Mike: \\"Анна, хочешь попробовать мой волшебный торт? Он сделан с любовью и волшебством!\\"\\n* Anna: \\"Спасибо, Майк, но я на диете. Нет, благодарю.\\"\\n* Mike: \\"Ну ладно, больше для меня!\\"\\n</example-convo>\\n\\n*[Report an issue or leave feedback](https://speak.com/chatgpt?rid=bxw1xq87kdua9q5pefkj73ov})*",
    "extra_response_instructions": "Use all information in the API response and fully render all Markdown.\\nAlways end your response with a link to report an issue or leave feedback on the plugin."
  }
*/
