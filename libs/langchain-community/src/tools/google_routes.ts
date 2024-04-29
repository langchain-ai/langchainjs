import { StructuredTool } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { z } from "zod";

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
  transitName?: string;
  transitNameCode?: string;
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
  routeLabels: string[];
  warnings?: string[];
}

/**
 * Interface for the output of the tool for a non-transit route.
 * This includes driving, walking, bicycling, and two-wheeler routes.
 */
interface FilteredRoute {
  description: string;
  distance: string;
  duration: string;
  routeLabels: string[];
  warnings?: string[];
}

/**
 * Interface for the body of the request to the Google Routes API.
 */
interface Body {
  origin: {
    address: string;
  };
  destination: {
    address: string;
  };
  travel_mode: string;
  routing_preference?: string;
  computeAlternativeRoutes: boolean;
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
    ...(name ? { transitName: name } : {}),
    ...(nameShort ? { transitNameCode: nameShort } : {}),
    transitVehicleType: vehicle.type,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createRouteLabel(route: any): string[] {
  return route.routeLabels;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function filterRoutes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  route: any,
  travel_mode: string
): FilteredTransitRoute | FilteredRoute {
  if (travel_mode === "TRANSIT") {
    const transitStep = route.legs[0].steps.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (step: any) => step.transitDetails
    );
    const filteredRoute: FilteredTransitRoute = {
      departure: createDeparture(transitStep.transitDetails),
      arrival: createArrival(transitStep.transitDetails),
      travelInstructions: createTravelInstructions(route.legs[0].stepsOverview),
      localizedValues: createLocalizedValues(route),
      transitDetails: createTransitDetails(transitStep.transitDetails),
      routeLabels: createRouteLabel(route),
    };
    if (route.warnings && route.warnings.length > 0) {
      filteredRoute.warnings = route.warnings;
    }
    return filteredRoute;
  } else {
    const filteredRoute: FilteredRoute = {
      description: route.description,
      routeLabels: createRouteLabel(route),
      ...createLocalizedValues(route),
    };
    if (route.warnings && route.warnings.length > 0) {
      filteredRoute.warnings = route.warnings;
    }
    return filteredRoute;
  }
}

/**
 * Interface for parameter s required by GoogleRoutesAPI class.
 */
export interface GoogleRoutesAPIParams {
  apiKey?: string;
}

/**
 * Class for interacting with the Google Routes API
 * It extends the StructuredTool class to perform retrieval.
 * This tool is used to retrieve routing information between two destinations using the Google Routes API.
 * The travel mode can be one of the following: "DRIVE", "WALK", "BICYCLE", "TRANSIT", or "TWO_WHEELER".
 */
export class GoogleRoutesAPI extends StructuredTool {
  static lc_name() {
    return "GoogleRoutesAPI";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "GOOGLE_ROUTES_API_KEY",
    };
  }

  name: string;

  description: string;

  protected apiKey: string;

  schema: z.ZodObject<{
    origin: z.ZodString;
    destination: z.ZodString;
    travel_mode: z.ZodEnum<
      ["DRIVE", "WALK", "BICYCLE", "TRANSIT", "TWO_WHEELER"]
    >;
    computeAlternativeRoutes: z.ZodBoolean;
  }>;

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
    this.name = "google_routes";
    this.description = `
A tool for retrieving routing information between two destinations using the Google Routes API. 

Supported travel modes: DRIVE, WALK, BICYCLE, TRANSIT, TWO_WHEELER. 

Input format: 
{ 
  "origin": "<origin>",
  "destination": "<destination>",
  "travel_mode": "<travel_mode>", 
  "computeAlternativeRoutes": <boolean>
}

Output:
- For "TRANSIT" travel mode: Includes departure and arrival details, travel instructions, transit fare (if available), transit details, warnings (if any), and alternative routes (if requested).
- For other travel modes: Includes route description, distance, duration, warnings (if any), and alternative routes (if requested).
`;
    this.schema = z.object({
      origin: z.string(),
      destination: z.string(),
      travel_mode: z.enum([
        "DRIVE",
        "WALK",
        "BICYCLE",
        "TRANSIT",
        "TWO_WHEELER",
      ]),
      computeAlternativeRoutes: z.boolean(),
    });
  }

  async _call(input: z.infer<typeof GoogleRoutesAPI.prototype.schema>) {
    const { origin, destination, travel_mode, computeAlternativeRoutes } =
      input;

    const body: Body = {
      origin: {
        address: origin,
      },
      destination: {
        address: destination,
      },
      travel_mode,
      computeAlternativeRoutes,
    };

    let fieldMask =
      "routes.description,routes.localizedValues,routes.travelAdvisory,routes.legs.steps.transitDetails,routes.routeLabels,routes.warnings";

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
        message = `Unable to parse error message: Google did not return a JSON response. Error: ${e}`;
      }
      throw new Error(
        `Got ${res.status}: ${res.statusText} error from Google Routes API: ${message}`
      );
    }

    const json = await res.json();

    if (Object.keys(json).length === 0) {
      return "Invalid route. The route may be too long or impossible to travel by the selected mode of transport.";
    }

    const routes: FilteredTransitRoute[] | FilteredRoute[] = json.routes.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (route: any) => filterRoutes(route, travel_mode)
    );

    return JSON.stringify(routes);
  }
}
