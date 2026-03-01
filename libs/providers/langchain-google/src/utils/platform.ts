export type GooglePlatformType = "gai" | "gcp";

export function getPlatformType(
  platform: GooglePlatformType | undefined,
  hasApiKey: boolean
): GooglePlatformType {
  if (typeof platform !== "undefined") {
    return platform;
  } else if (hasApiKey) {
    return "gai";
  } else {
    return "gcp";
  }
}