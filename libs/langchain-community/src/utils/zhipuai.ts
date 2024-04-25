import jsonwebtoken from "jsonwebtoken";

const API_TOKEN_TTL_SECONDS = 3 * 60;
const CACHE_TTL_SECONDS = API_TOKEN_TTL_SECONDS - 30;
const tokenCache: {
  [key: string]: {
    token: string;
    createAt: number;
  };
} = {};

export const encodeApiKey = (apiSecretKey?: string, cache = true): string => {
  if (!apiSecretKey) throw new Error("Api_key is required");
  try {
    if (
      tokenCache[apiSecretKey] &&
      Date.now() - tokenCache[apiSecretKey].createAt < CACHE_TTL_SECONDS * 1000
    ) {
      return tokenCache[apiSecretKey].token;
    }

    const [apiKey, secret] = apiSecretKey.split(".");
    const payload = {
      api_key: apiKey,
      exp: Math.round(Date.now() * 1000) + API_TOKEN_TTL_SECONDS * 1000,
      timestamp: Math.round(Date.now() * 1000),
    };
    // algorithm = "HS256", headers = { "alg": "HS256", "sign_type": "SIGN" }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const ret = jsonwebtoken.sign(payload, secret, {
      algorithm: "HS256",
      header: { alg: "HS256", sign_type: "SIGN" },
    });
    if (cache) {
      tokenCache[apiSecretKey] = {
        token: ret,
        createAt: Date.now(),
      };
    }
    return ret;
  } catch (e) {
    throw new Error("invalid api_key");
  }
};
