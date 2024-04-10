import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  temperature: 0.9,
  model: "claude-3-sonnet-20240229",
  // In Node.js defaults to process.env.ANTHROPIC_API_KEY,
  // apiKey: "YOUR-API-KEY",
  maxTokens: 1024,
});

const res = await model.invoke("Why is the sky blue?");

console.log(res);

/*
  AIMessage {
    content: "The sky appears blue because of how air in Earth's atmosphere interacts with sunlight. As sunlight passes through the atmosphere, light waves get scattered by gas molecules and airborne particles. Blue light waves scatter more easily than other color light waves. Since blue light gets scattered across the sky, we perceive the sky as having a blue color.",
    name: undefined,
    additional_kwargs: {
      id: 'msg_01JuukTnjoXHuzQaPiSVvZQ1',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-sonnet-20240229',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 15, output_tokens: 70 }
    }
  }
*/
