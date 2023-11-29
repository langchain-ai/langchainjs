import { OutlookIntegration } from '../outlook/outlookIntegration.js';
import { AuthFlowREST } from '../outlook/authFlowREST.js';

// const toolParams = {};
let outlookTool: OutlookIntegration;

describe("outlook integration test suite", () => {
  beforeAll(async() => {
    const clientId = '6e6fad12-297a-4f81-9472-11b2d07831be';
    const clientSecret = 'ACm8Q~ErjhV4weyW5uBBUoDQprkWpP.rgwwI1c-y';
    const redirectUri = 'http://localhost:3000/oauth-callback';
    const authflow = new AuthFlowREST(clientId, clientSecret, redirectUri)
    const access_token = await authflow.getAccessToken();
    outlookTool = new OutlookIntegration(access_token);
  });

  // test("Pass", async () => {
  //   expect(true).toBe(true);
  // });

  test("Test read me", async () => {
    const res = await outlookTool.readme();
    console.log(res);
    expect(res).toBeDefined();
  });

  test("Test read emails", async () => {
    const emails = await outlookTool.readEmails();
    expect(emails).toBeDefined();
  });

  test("Test send email", async () => {
    const res = await outlookTool.sendEmail();
    console.log(res);
    expect(res).toBeDefined();
  });

});