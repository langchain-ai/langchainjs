import { WatsonXAI } from "@ibm-cloud/watsonx-ai";
import { Gateway } from "@ibm-cloud/watsonx-ai/gateway";
import {
  authenticateAndSetInstance,
  authenticateAndSetGatewayInstance,
} from "../ibm.js";

const fakeAuthProp = {
  watsonxAIAuthType: "iam",
  watsonxAIApikey: "fake_key",
};
const serviceUrl = "https://fake.url/";
describe("Utils tests", () => {
  describe("Positive tests", () => {
    test("Test authentication function", () => {
      const instance = authenticateAndSetInstance({
        version: "2024-05-31",
        serviceUrl,
        ...fakeAuthProp,
      });
      expect(instance).toBeInstanceOf(WatsonXAI);
    });

    test("Test authentication gateway function", () => {
      const instance = authenticateAndSetGatewayInstance({
        version: "2024-05-31",
        serviceUrl,
        ...fakeAuthProp,
      });
      expect(instance).toBeInstanceOf(Gateway);
    });
  });
});
