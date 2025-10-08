import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  temperature: 0.9,
  model: "claude-3-5-sonnet-20240620",
  // In Node.js defaults to process.env.ANTHROPIC_API_KEY,
  // apiKey: "YOUR-API-KEY",
  maxTokens: 1024,
});

const res = await model.invoke("Why is the sky blue?");

console.log(res);

/*
  AIMessage {
    content: "The sky appears blue due to a phenomenon called Rayleigh scattering. Here's a brief explanation:\n" +
      '\n' +
      '1. Sunlight contains all colors of the visible spectrum.\n' +
      '\n' +
      "2. As sunlight enters Earth's atmosphere, it collides with gas molecules and other particles.\n" +
      '\n' +
      '3. These collisions cause the light to scatter in all directions.\n' +
      '\n' +
      '4. Blue light has a shorter wavelength and higher frequency than other colors in the visible spectrum, so it scatters more easily than other colors.\n' +
      '\n' +
      '5. This scattered blue light reaches our eyes from all directions, making the sky appear blue.\n' +
      '\n' +
      '6. Other colors, like red and yellow, have longer wavelengths and pass through the atmosphere more directly, which is why we see them primarily during sunrise and sunset when sunlight travels through more of the atmosphere to reach our eyes.\n' +
      '\n' +
      'This effect is more pronounced during the day when the sun is high in the sky. At sunrise and sunset, when sunlight travels through more of the atmosphere, we see more red and orange colors because the blue light has been scattered away by the time it reaches our eyes.',
    response_metadata: {
      id: 'msg_013zKN9RXhpyCeHNsgwHjHsi',
      model: 'claude-3-5-sonnet-20240620',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 13, output_tokens: 233 }
    },
    tool_calls: [],
    invalid_tool_calls: [],
    usage_metadata: { input_tokens: 13, output_tokens: 233, total_tokens: 246 }
  }
*/
