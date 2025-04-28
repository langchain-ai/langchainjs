import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  model: "claude-3-sonnet-20240229",
  maxTokens: 1024,
  clientOptions: {
    defaultHeaders: {
      "X-Api-Key": process.env.ANTHROPIC_API_KEY,
    },
  },
});

const res = await model.invoke("Why is the sky blue?");

console.log(res);

/*
  AIMessage {
    content: "The sky appears blue because of the way sunlight interacts with the gases in Earth's atmosphere. Here's a more detailed explanation:\n" +
      '\n' +
      '- Sunlight is made up of different wavelengths of light, including the entire visible spectrum from red to violet.\n' +
      '\n' +
      '- As sunlight passes through the atmosphere, the gases (nitrogen, oxygen, etc.) cause the shorter wavelengths of light, in the blue and violet range, to be scattered more efficiently in different directions.\n' +
      '\n' +
      '- The blue wavelengths of about 475 nanometers get scattered more than the other visible wavelengths by the tiny gas molecules in the atmosphere.\n' +
      '\n' +
      '- This preferential scattering of blue light in all directions by the gas molecules is called Rayleigh scattering.\n' +
      '\n' +
      '- When we look at the sky, we see this scattered blue light from the sun coming at us from all parts of the sky.\n' +
      '\n' +
      "- At sunrise and sunset, the sun's rays have to travel further through the atmosphere before reaching our eyes, causing more of the blue light to be scattered out, leaving more of the red/orange wavelengths visible - which is why sunrises and sunsets appear reddish.\n" +
      '\n' +
      'So in summary, the blueness of the sky is caused by this selective scattering of blue wavelengths of sunlight by the gases in the atmosphere.',
    name: undefined,
    additional_kwargs: {
      id: 'msg_01Mvvc5GvomqbUxP3YaeWXRe',
      type: 'message',
      role: 'assistant',
      model: 'claude-3-sonnet-20240229',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 13, output_tokens: 284 }
    }
  }
*/
