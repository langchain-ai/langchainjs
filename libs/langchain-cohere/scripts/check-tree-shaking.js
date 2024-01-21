import { checkTreeShaking } from "@langchain/scripts";

checkTreeShaking({
  extraInternals: [/node\:/, /@langchain\/core\//],
});
