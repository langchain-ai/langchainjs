import { describe, test } from "@jest/globals";
import {MakerSuitePrompt} from "../googlemakersuitehub.js";

describe("Google Maker Suite Hub", () => {

  test("Prompt template", () => {
    const prompt = new MakerSuitePrompt({
      textPrompt: {
        value: "What would be a good name for a company that makes {{30E275F8-0B60-4E71-843D-9865F4D4EFD4:product:}}?"
      }
    });
    const template = prompt.toTemplate();
    expect(template.template).toEqual("What would be a good name for a company that makes {product}?")
  });

})