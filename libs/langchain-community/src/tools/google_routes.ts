import { StructuredTool } from "@langchain/core/tools";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { InferInteropZodOutput } from "@langchain/core/utils/types";
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

interface TollInfo {
  currencyCode: string;
  value: string;
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
  tollInfo?: TollInfo;
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
  departureTime?: string;
  arrivalTime?: string;
  transitPreferences?: {
    routingPreference: string;
  };
  extraComputations?: string[];
}

const getTimezoneOffsetInHours = () => {
  const offsetInMinutes = new Date().getTimezoneOffset();
  const offsetInHours = -offsetInMinutes / 60;
  return offsetInHours;
};

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
    if (route.travelAdvisory && route.travelAdvisory.tollInfo) {
      filteredRoute.tollInfo = {
        currencyCode:
          route.travelAdvisory.tollInfo.estimatedPrice[0].currencyCode,
        value: route.travelAdvisory.tollInfo.estimatedPrice[0].units,
      };
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

const defaultGoogleRoutesSchema = z.object({
  origin: z
    .string()
    .describe(`Origin address, can be either a place or an address.`),
  destination: z
    .string()
    .describe(`Destination address, can be either a place or an address.`),
  travel_mode: z
    .enum(["DRIVE", "WALK", "BICYCLE", "TRANSIT", "TWO_WHEELER"])
    .describe(`The mode of transport`),
  computeAlternativeRoutes: z
    .boolean()
    .describe(
      `Compute alternative routes, set to true if user wants multiple routes, false otherwise.`
    ),
  departureTime: z
    .string()
    .optional()
    .describe(
      `Time that the user wants to depart.
      There cannot be a departure time if an arrival time is specified.
      Expected departure time should be provided as a timestamp in RFC3339 format: YYYY-MM-DDThh:mm:ss+00:00. The date should be in UTC time and the +00:00 represents the UTC offset. 
      For instance, if the the user's timezone is -5, the offset would be -05:00 meaning YYYY-MM-DDThh:mm:ss-05:00 with YYYY-MM-DDThh:mm:ss being in UTC. 
      For reference, here is the current time in UTC: ${new Date().toISOString()} and the user's timezone offset is ${getTimezoneOffsetInHours()}. 
      If the departure time is not specified it should not be included.          
      `
    ),
  arrivalTime: z
    .string()
    .optional()
    .describe(
      `Time that the user wants to arrive.
      There cannot be an arrival time if a departure time is specified.
      Expected arrival time should be provided as a timestamp in RFC3339 format: YYYY-MM-DDThh:mm:ss+00:00. The date should be in UTC time and the +00:00 represents the UTC offset. 
      For instance, if the the user's timezone is -5, the offset would be -05:00 meaning YYYY-MM-DDThh:mm:ss-05:00 with YYYY-MM-DDThh:mm:ss being in UTC. 
      For reference, here is the current time in UTC: ${new Date().toISOString()} and the user's timezone offset is ${getTimezoneOffsetInHours()}. 
      Reminder that the arrival time must be in the future, if the user asks for a arrival time in the past instead of processing the request, warn them that it is not possible to calculate a route for a past time.
      If the user asks for a arrival time in a passed hour today, calculate it for the next day.
      If the arrival time is not specified it should not be included. `
    ),
  transitPreferences: z
    .object({
      routingPreference: z.enum(["LESS_WALKING", "FEWER_TRANSFERS"])
        .describe(`Transit routing preference.
        By default, it should not be included.`),
    })
    .optional()
    .describe(
      `Transit routing preference.
       By default, it should not be included.`
    ),
  extraComputations: z
    .array(z.enum(["TOLLS"]))
    .optional()
    .describe(`Calculate tolls for the route.`),
});

/**
 * Class for interacting with the Google Routes API
 * It extends the StructuredTool class to perform retrieval.
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

  schema: typeof defaultGoogleRoutesSchema = defaultGoogleRoutesSchema;

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
    This tool retrieves routing info using the Google Routes API for driving, walking, biking, transit, and two-wheeler routes. Get departure/arrival times, travel instructions, transit fare, warnings, alternative routes, tolls prices, and routing preferences like less walking or fewer transfers.

    Output:
    - "TRANSIT" mode: Departure/arrival details, transit name/code, fare, details, warnings, alternative routes, and expected departure/arrival times.
    - Other modes: Route description, distance, duration, warnings, alternative routes, tolls prices, and expected departure/arrival times.
    
    Current time in user's timezone: ${new Date().toLocaleString()}.
    `;
  }

  async _call(
    input: InferInteropZodOutput<typeof GoogleRoutesAPI.prototype.schema>
  ) {
    const {
      origin,
      destination,
      travel_mode,
      computeAlternativeRoutes,
      departureTime,
      arrivalTime,
      transitPreferences,
      extraComputations,
    } = input;

    const now = new Date();

    if (departureTime && new Date(departureTime) < now) {
      return "It is not possible to calculate a route with a past departure time. Warn the user that it is not possible to calculate a route with a past departure time.";
    }

    if (arrivalTime && new Date(arrivalTime) < now) {
      return "It is not possible to calculate a route with a past arrival time. Warn the user that it is not possible to calculate a route with a past arrival time.";
    }

    if (travel_mode !== "TRANSIT" && arrivalTime) {
      return "It is not possible to calculate an arrival time for modes other than transit. Warn the user that it is not possible to calculate an arrival time for the selected mode of transport.";
    }

    if (travel_mode === "TRANSIT" && extraComputations) {
      return "It is not possible to calculate tolls for transit mode. Warn the user that it is not possible to calculate tolls for transit mode.";
    }

    const body: Body = {
      origin: {
        address: origin,
      },
      destination: {
        address: destination,
      },
      travel_mode,
      computeAlternativeRoutes: computeAlternativeRoutes ?? false,
      departureTime,
      arrivalTime,
      transitPreferences,
      extraComputations: (extraComputations as string[]) ?? [],
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
