import { GoogleAuth } from "google-auth-library";
import { getIAMPrincipalEmail } from "../utils/utils.js";

// Google Cloud Test only
describe("Getting IAM Principal Email", () => {
  test.skip("should return the IAM principal email account", async () => {
    const auth = new GoogleAuth({
      scopes: "https://www.googleapis.com/auth/cloud-platform",
    });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const mail = await getIAMPrincipalEmail(auth);
    expect(emailRegex.test(mail)).toBe(true);
  });
});
