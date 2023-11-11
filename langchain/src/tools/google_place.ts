import { getEnvironmentVariable } from "../util/env.js";
import { Tool } from "./base.js";

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
      apiKey: "GPLACES_API_KEY",
    };
  }

  name = "google_places";

  protected apiKey: string;

  description = `A wrapper around Google Places API.
  Useful for when you need to validate or
  discover addressed from ambiguous text.
  Input should be a search query.`;

  
  constructor(
    fields: GooglePlacesAPIParams = {
      apiKey: getEnvironmentVariable("GPLACES_API_KEY"), //somehow doesn't work, need fix
    }
  ) {
    super(...arguments);
    if (!fields.apiKey) {
      throw new Error(
        `Google Places API key not set. You can set it as "GPLACES_API_KEY" in your environment variables.`
      );
    }
    this.apiKey = fields.apiKey;
  }

  async _call(input: string) {
    const res = await fetch(
        `https://places.googleapis.com/v1/places:searchText?key=${this.apiKey}&textQuery=${encodeURIComponent(input)}&languageCode=en`,
        {
            method: 'POST',
            headers: {
                'X-Goog-FieldMask':'places.displayName,places.formattedAddress,places.id,places.internationalPhoneNumber,places.websiteUri'
            }
        }
    );

    if (!res.ok) {
        await res.text().then(text => console.log(text))
        throw new Error(
        `Got ${res.status} error from Google Places API: ${res.statusText}`
      );
    }

    const json = await res.json();

    const results =
      json?.places?.map(
        (place: { id?: string; internationalPhoneNumber?: string; formattedAddress?: string; websiteUri?: string; displayName?: {text?:string} }) => ({
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