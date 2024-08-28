import { ChatVertexAI } from "@langchain/google-vertexai";
// Or, if using the web entrypoint:
// import { ChatVertexAI } from "@langchain/google-vertexai-web";

const model = new ChatVertexAI({
  temperature: 0.7,
  model: "gemini-1.5-flash-001",
});

const response = await model.invoke("Why is the ocean blue?");
console.log(response);
/*
AIMessageChunk {
  "content": "The ocean appears blue due to a combination of factors:\n\n**1. Rayleigh Scattering:**\n\n* This is the primary reason.  Sunlight is made up of all colors of the rainbow.  When sunlight enters the ocean, blue wavelengths are scattered more than other colors by water molecules. \n* This scattered blue light is what we see.  Think of it like sunlight being scattered by the atmosphere, making the sky appear blue.\n\n**2. Absorption of Other Colors:**\n\n* Water absorbs red, orange, yellow, and green wavelengths of light more readily than blue.  This means less of those colors reach our eyes.\n* The deeper the water, the more red light is absorbed, making the ocean appear even bluer.\n\n**3. Other Factors:**\n\n* **Depth:**  The deeper the water, the bluer it appears.\n* **Turbidity:**  The presence of particles like sediment or plankton can affect the color.  A cloudy ocean might appear more greenish or brown.\n* **Time of Day:**  The ocean can appear different colors depending on the angle of the sun.\n\n**In Summary:**\n\nThe ocean appears blue primarily due to Rayleigh scattering, where blue wavelengths of light are scattered more effectively by water molecules. This, combined with the absorption of other colors by water, results in the blue hue we perceive.\n",
  "usage_metadata": {
    "input_tokens": 6,
    "output_tokens": 276,
    "total_tokens": 282
  }
}
 */
