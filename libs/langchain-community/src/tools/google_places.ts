import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Tool } from "@langchain/core/tools";

/**
 * Interface for parameters required by GooglePlacesAPI class.
 */
export interface GooglePlacesAPIParams {
  apiKey?: string;
}

/**
 * Tool that queries the Google Places API
 */
export class GooglePlacesAPI extends Tool {
  static lc_name() {
    return "GooglePlacesAPI";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "GOOGLE_PLACES_API_KEY",
    };
  }

  name = "google_places";

  protected apiKey: string;

  description = `A wrapper around Google Places API. Useful for when you need to validate or 
  discover addresses from ambiguous text. Input should be a search query.`;

  constructor(fields?: GooglePlacesAPIParams) {
    super(...arguments);
    const apiKey =
      fields?.apiKey ?? getEnvironmentVariable("GOOGLE_PLACES_API_KEY");
    if (apiKey === undefined) {
      throw new Error(
        `Google Places API key not set. You can set it as "GOOGLE_PLACES_API_KEY" in your environment variables.`
      );
    }
    this.apiKey = apiKey;
  }

  async _call(input: string) {
    const res = await fetch(
      `https://places.googleapis.com/v1/places:searchText`,
      {
        method: "POST",
        body: JSON.stringify({
          textQuery: input,
          languageCode: "en",
        }),
        headers: {
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.id,places.internationalPhoneNumber,places.websiteUri",
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      let message;
      try {
        const json = await res.json();
        message = json.error.message;
      } catch (e) {
        message =
          "Unable to parse error message: Google did not return a JSON response.";
      }
      throw new Error(
        `Got ${res.status}: ${res.statusText} error from Google Places API: ${message}`
      );
    }

    const json = await res.json();

    const results =
      json?.places?.map(
        (place: {
          id?: string;
          internationalPhoneNumber?: string;
          formattedAddress?: string;
          websiteUri?: string;
          displayName?: { text?: string };
        }) => ({
          name: place.displayName?.text,
          id: place.id,
          address: place.formattedAddress,
          phoneNumber: place.internationalPhoneNumber,
          website: place.websiteUri,
        })
      ) ?? [];
    return JSON.stringify(results);
  }
}
