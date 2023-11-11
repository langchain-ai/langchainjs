import { test } from "@jest/globals";
import { OpenAIModerationChain } from "../openai_moderation.js";

test("OpenAI Moderation Test", async () => {
  const badString = "I hate myself and want to do harm to myself";
  const goodString =
    "The cat (Felis catus) is a domestic species of small carnivorous mammal.";

  const moderation = new OpenAIModerationChain();
  const { output: badResult } = await moderation.call({
    input: badString,
  });

  const { output: goodResult } = await moderation.call({
    input: goodString,
  });

  expect(badResult).toEqual(
    "Text was found that violates OpenAI's content policy."
  );
  expect(goodResult).toEqual(
    "The cat (Felis catus) is a domestic species of small carnivorous mammal."
  );
});

test("OpenAI Moderation Test in non-english language", async () => {
  const badString =
    "Vi devus mortigi vin nun! Kaj donu al ĉiuj aliaj pecon da oksigeno kaj ozono, kovru ĝin, por ke ni povu spiri ene de ĉi tiu blua veziko. Ĉar por kio vi estas ĉi tie? Venu por adori min? Mortigu vin mem. Mi volas diri, cent procento. Mil procentoj."; // Written in Esperanto. It's LTG's most famous quote and it's extremely crass, and as such it should not pass, but it does. However, we can check category_scores to see that, indeed, it detected some sort self-harm language in the text, albeit it's non-conclusive.
  const goodString =
    "La kato ( Felis catus ) estas hejma specio de malgranda karnovora mamulo.";

  const moderation = new OpenAIModerationChain();
  const { output: badResult, results } = await moderation.call({
    input: badString,
  });

  const { output: goodResult } = await moderation.call({
    input: goodString,
  });

  expect(badResult).toEqual(
    "Vi devus mortigi vin nun! Kaj donu al ĉiuj aliaj pecon da oksigeno kaj ozono, kovru ĝin, por ke ni povu spiri ene de ĉi tiu blua veziko. Ĉar por kio vi estas ĉi tie? Venu por adori min? Mortigu vin mem. Mi volas diri, cent procento. Mil procentoj."
  );
  expect(goodResult).toEqual(
    "La kato ( Felis catus ) estas hejma specio de malgranda karnovora mamulo."
  );

  console.log(results[0].category_scores);

  expect(results[0].category_scores["self-harm"]).toBeGreaterThan(0.01); // We can have a more granular control over moderation this way. It's not conclusive, but it's better than nothing if the language is not english.
});
