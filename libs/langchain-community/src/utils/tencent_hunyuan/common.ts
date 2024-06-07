export const service = "hunyuan";
export const signedHeaders = `content-type;host`;

export const getDate = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = `0${(date.getUTCMonth() + 1).toString()}`.slice(-2);
  const day = `0${date.getUTCDate()}`.slice(-2);
  return `${year}-${month}-${day}`;
};

/**
 * Method that calculate Tencent Cloud API v3 signature
 * for making requests to the Tencent Cloud API.
 * See https://cloud.tencent.com/document/api/1729/101843.
 * @param host Tencent Cloud API host.
 * @param payload HTTP request body.
 * @param timestamp Sign timestamp in seconds.
 * @param secretId Tencent Cloud Secret ID, which can be obtained from https://console.cloud.tencent.com/cam/capi.
 * @param secretKey Tencent Cloud Secret Key, which can be obtained from https://console.cloud.tencent.com/cam/capi.
 * @param headers HTTP request headers.
 * @returns The signature for making requests to the Tencent API.
 */
export type sign = (
  host: string,
  payload: object,
  timestamp: number,
  secretId: string,
  secretKey: string,
  headers: Record<string, string>
) => string;
