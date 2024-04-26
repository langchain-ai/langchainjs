import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Tool } from "@langchain/core/tools";

/**
 * Interface for parameters required by GoogleRoutesAPI class.
 */
export interface GoogleRoutesAPIParams {
  apiKey?: string;
}

interface Arrival {
  arrivalTime: string;
  localizedTime: string;
  localizedTimezone: string;
  arrivalAddress: string;
}

interface Departure {
  departureTime: string;
  localizedTime: string;
  localizedTimezone: string;
  departureAddress: string;
}

interface transitDetails {
  transitName: string;
  transitNameCode: string;
  transitVehicleType: string;
}

interface travelInstructions {
  navigationInstruction: string;
  travelMode: string;
}

interface localizedValues {
  distance: string;
  duration: string;
  transitFare?: string;
}

interface FilteredTransitRoute {
  departure: Departure;
  arrival: Arrival;
  travelInstructions: travelInstructions[];
  localizedValues: localizedValues;
  transitDetails: transitDetails;
}

interface FilteredRoute {
  description: string;
  distance: string;
  duration: string;
}

interface Body {
  origin: {
    address: string;
  };
  destination: {
    address: string;
  };
  travel_mode: string;
  routing_preference?: string;
}

/**
 * Tool that queries the Google Places API
 */
export class GoogleRoutesAPI extends Tool {
  static lc_name() {
    return "GoogleRoutesAPI";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "GOOGLE_ROUTES_API_KEY",
    };
  }

  name = "google_routes";

  protected apiKey: string;

  description = `A tool for retrieving routing information between two destinations using Google Routes API.

  INPUT examples:

  "action": "google_routes",
  "action_input": "1600 Amphitheatre Parkway, Mountain View, CA|450 Serra Mall, Stanford, CA 94305, USA|DRIVE"

  "action": "google_routes",
  "action_input": "Big Ben|Buckingham Palace|WALK"

  "action": "google_routes",
  "action_input": "Westfield London, Ariel Way|Wembley Stadium|TRANSIT"

  OUTPUT:
  - For "DRIVE", "WALK", "BICYCLE", and "TWO_WHEELER" travel modes, your output is the information about the route, including the description, distance, and duration.
  - For "TRANSIT" travel mode, your output is the information about the route, including the departure and arrival details, travel instructions, transit fare (if included in the API), and transit details.

  Note:
  - The travel mode can be one of the following: "DRIVE", "WALK", "BICYCLE", "TRANSIT", or "TWO_WHEELER".
  - Do not use any tool to convert or parse your output. The output should be based on the API response.
  - The API will only return one route for the given input. You must only tell the user about that route.
  `;

  constructor(fields?: GoogleRoutesAPIParams) {
    super(...arguments);
    const apiKey =
      fields?.apiKey ?? getEnvironmentVariable("GOOGLE_ROUTES_API_KEY");
    if (apiKey === undefined) {
      throw new Error(
        `Google Routes API key not set. You can set it as "GOOGLE_ROUTES_API_KEY" in your environment variables.`
      );
    }
    this.apiKey = apiKey;
  }

  async _call(input: string) {
    const parsedInput = input.split("|");
    console.log("Tool input:", parsedInput);
    const [origin, destination, travel_mode] = parsedInput;

    const body: Body = {
      origin: {
        address: origin,
      },
      destination: {
        address: destination,
      },
      travel_mode,
    };

    let fieldMask =
      "routes.description,routes.localizedValues,routes.travelAdvisory,routes.legs.steps.transitDetails";

    if (travel_mode === "TRANSIT") {
      fieldMask += ",routes.legs.stepsOverview";
    }

    if (travel_mode === "DRIVE" || travel_mode === "TWO_WHEELER") {
      body.routing_preference = "TRAFFIC_AWARE";
    }

    const res = await fetch(
      `https://routes.googleapis.com/directions/v2:computeRoutes`,
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "X-Goog-Api-Key": this.apiKey,
          "X-Goog-FieldMask": fieldMask,
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
        `Got ${res.status}: ${res.statusText} error from Google Routes API: ${message}`
      );
    }

    const json = await res.json();

    if (Object.keys(json).length === 0) {
      return "Invalid route. No data returned from the API.";
    }

    let routes: FilteredTransitRoute[] | FilteredRoute[];

    if (travel_mode === "TRANSIT") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      routes = json.routes.map((route: any) => {
        const transitStep = route.legs[0].steps.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (step: any) => step.transitDetails
        );
        const departure: Departure = {
          departureTime: transitStep.transitDetails.stopDetails.departureTime,
          localizedTime:
            transitStep.transitDetails.localizedValues.departureTime.time.text,
          localizedTimezone:
            transitStep.transitDetails.localizedValues.departureTime.timeZone,
          departureAddress:
            transitStep.transitDetails.stopDetails.departureStop.name,
        };
        const arrival: Arrival = {
          arrivalTime: transitStep.transitDetails.stopDetails.arrivalTime,
          localizedTime:
            transitStep.transitDetails.localizedValues.arrivalTime.time.text,
          localizedTimezone:
            transitStep.transitDetails.localizedValues.arrivalTime.timeZone,
          arrivalAddress:
            transitStep.transitDetails.stopDetails.arrivalStop.name,
        };
        const travelInstructions: travelInstructions[] =
          route.legs[0].stepsOverview.multiModalSegments.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (segment: any) => ({
              ...(segment.navigationInstruction
                ? {
                    navigationInstruction:
                      segment.navigationInstruction.instructions,
                  }
                : {}),
              travelMode: segment.travelMode,
            })
          );
        const localizedValues: localizedValues = {
          distance: route.localizedValues.distance.text,
          duration: route.localizedValues.duration.text,
          ...(route.localizedValues.transitFare.text
            ? { transitFare: route.localizedValues.transitFare.text }
            : {}),
        };
        const transitDetails: transitDetails = {
          transitName: transitStep.transitDetails.transitLine.name,
          transitNameCode: transitStep.transitDetails.transitLine.nameShort,
          transitVehicleType:
            transitStep.transitDetails.transitLine.vehicle.type,
        };
        return {
          departure,
          arrival,
          travelInstructions,
          localizedValues,
          transitDetails,
        };
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      routes = json.routes.map((route: any) => ({
        description: route.description,
        distance: route.localizedValues.distance.text,
        duration: route.localizedValues.duration.text,
      }));
    }

    console.dir(routes, { depth: null });

    return JSON.stringify(routes);
  }
}
