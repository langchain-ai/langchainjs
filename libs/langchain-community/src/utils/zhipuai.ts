import jwt from "jsonwebtoken";

export function encodeApiKey(apiKey: string | undefined) {
  if (!apiKey) throw Error("Invalid api key");
  const [key, secret] = apiKey.split(".");
  const API_TOKEN_TTL_SECONDS = 3 * 60;
  const now = new Date().valueOf();
  const payload = {
    api_key: key,
    exp: now + API_TOKEN_TTL_SECONDS * 1000,
    timestamp: now,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = {
    algorithm: "HS256",
    header: {
      alg: "HS256",
      sign_type: "SIGN",
    },
  };
  return jwt.sign(payload, secret, options);
}
