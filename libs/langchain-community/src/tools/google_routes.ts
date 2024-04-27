import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Tool } from "@langchain/core/tools";

/**
 * Interface for parameters required by GoogleRoutesAPI class.
 */
export interface GoogleRoutesAPIParams {
  apiKey?: string;
}

/**
 * Interfaces for the response from the Google Routes API.
 */
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

/**
 * Interface for the output of the tool for a transit route.
 */
interface FilteredTransitRoute {
  departure: Departure;
  arrival: Arrival;
  travelInstructions: travelInstructions[];
  localizedValues: localizedValues;
  transitDetails: transitDetails;
}

/**
 * Interface for the output of the tool for a non-transit route.
 * This includes driving, walking, bicycling, and two-wheeler routes.
 */
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
 * Helper functions to create the response objects for the Google Routes API.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createDeparture(transitDetails: any): Departure {
  const { stopDetails, localizedValues } = transitDetails;
  return {
    departureTime: stopDetails.departureTime,
    localizedTime: localizedValues.departureTime.time.text,
    localizedTimezone: localizedValues.departureTime.timeZone,
    departureAddress: stopDetails.departureStop.name,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createArrival(transitDetails: any): Arrival {
  const { stopDetails, localizedValues } = transitDetails;
  return {
    arrivalTime: stopDetails.arrivalTime,
    localizedTime: localizedValues.arrivalTime.time.text,
    localizedTimezone: localizedValues.arrivalTime.timeZone,
    arrivalAddress: stopDetails.arrivalStop.name,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTravelInstructions(stepsOverview: any): travelInstructions[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return stepsOverview.multiModalSegments.map((segment: any) => ({
    ...(segment.navigationInstruction
      ? {
          navigationInstruction: segment.navigationInstruction.instructions,
        }
      : {}),
    travelMode: segment.travelMode,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createLocalizedValues(route: any): localizedValues {
  const { distance, duration, transitFare } = route.localizedValues;
  return {
    distance: distance.text,
    duration: duration.text,
    ...(transitFare?.text ? { transitFare: transitFare.text } : {}),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createTransitDetails(transitDetails: any): transitDetails {
  const { name, nameShort, vehicle } = transitDetails.transitLine;
  return {
    transitName: name,
    transitNameCode: nameShort,
    transitVehicleType: vehicle.type,
  };
}

/**
 * Class for interacting with the Google Routes API
 * It extends the base Tool class to perform retrieval.
 * This tool is used to retrieve routing information between two destinations using the Google Routes API.
 * The travel mode can be one of the following: "DRIVE", "WALK", "BICYCLE", "TRANSIT", or "TWO_WHEELER".
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
      return "Invalid route. The route may be too long or impossible to travel by the selected mode of transport.";
    }

    let routes: FilteredTransitRoute[] | FilteredRoute[];

    if (travel_mode === "TRANSIT") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      routes = json.routes.map((route: any) => {
        const transitStep = route.legs[0].steps.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (step: any) => step.transitDetails
        );
        return {
          departure: createDeparture(transitStep.transitDetails),
          arrival: createArrival(transitStep.transitDetails),
          travelInstructions: createTravelInstructions(
            route.legs[0].stepsOverview
          ),
          localizedValues: createLocalizedValues(route),
          transitDetails: createTransitDetails(transitStep.transitDetails),
        };
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      routes = json.routes.map((route: any) => ({
        description: route.description,
        ...createLocalizedValues(route),
      }));
    }

    return JSON.stringify(routes);
  }
}
