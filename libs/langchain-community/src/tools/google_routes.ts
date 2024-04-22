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
  routeName: string;
  routeNameShort: string;
  routeType: string;
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
  routeLabels: string[];
  localizedValues: localizedValues;
  transitDetails: transitDetails;
  routeLabel: string[];
}

interface FilteredRoute {
  description: string;
  distance: string;
  duration: string;
  routeLabel: string[];
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

  description = `A wrapper around Google Routes API. It provides an easy way to retrieve routing information between two destinations. 
  The input to this tool should be an array consisting of the origin address, destination address, and the desired travel mode. For example, 
  ["1600 Amphitheatre Parkway, Mountain View, CA", "450 Serra Mall, Stanford, CA 94305, USA", "DRIVE"]. 
  The travel mode can be one of the following: "DRIVE", "WALK", "BICYCLE", "TRANSIT", or "TWO_WHEELER".`;

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
    const parsedInput = JSON.parse(input);
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
      "routes.routeLabels,routes.description,routes.localizedValues,routes.travelAdvisory,routes.legs.steps.transitDetails";

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
        const { routeLabels } = route;
        const localizedValues: localizedValues = {
          distance: route.localizedValues.distance.text,
          duration: route.localizedValues.duration.text,
          ...(route.localizedValues.transitFare.text
            ? { transitFare: route.localizedValues.transitFare.text }
            : {}),
        };
        const transitDetails: transitDetails = {
          routeName: transitStep.transitDetails.transitLine.name,
          routeNameShort: transitStep.transitDetails.transitLine.nameShort,
          routeType: transitStep.transitDetails.transitLine.vehicle.type,
        };
        return {
          departure,
          arrival,
          travelInstructions,
          routeLabels,
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
        routeLabel: route.routeLabels,
      }));
    }

    console.dir(routes, { depth: null });

    return JSON.stringify(routes);
  }
}
