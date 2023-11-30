// import { OutlookIntegration } from '../outlook/outlookIntegration.js';
import { OutlookReadMailTool, OutlookSendMailTool } from '../outlook/index.js';
import { AuthFlowREST } from '../outlook/authFlowREST.js';

// const toolParams = {};


describe("outlook integration test suite", () => {
  beforeAll(async() => {
    const authflow = new AuthFlowREST()
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