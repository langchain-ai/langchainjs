import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Tool } from "@langchain/core/tools";

/**
 * Interface for parameters required by GoogleRoutesAPI class.
 */
export interface GoogleRoutesAPIParams {
  apiKey?: string;
}

interface LatLng {
  latitude: number;
  longitude: number;
}

interface NavigationInstruction {
  maneuver: string;
  instructions: string;
}

interface LocalizedValues {
  distance: {
    text: string;
  };
  staticDuration: {
    text: string;
  };
}

interface Step {
  distanceMeters: number;
  staticDuration: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  polyline: any | null;
  startLocation: {
    latLng: LatLng;
  };
  endLocation: {
    latLng: LatLng;
  };
  navigationInstruction: NavigationInstruction;
  localizedValues: LocalizedValues;
  travelMode: string;
}

interface Leg {
  steps: Step[];
}

interface Route {
  legs: Leg[];
  distanceMeters: number;
  duration: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  polyline: any | null;
  description: string;
  routeLabels: string[];
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

  description = `A wrapper around Google Routes API. Useful for when you need to get routes between destinations. Input should be an array with the origin, 
  destination and travel mode. An example is ["1600 Amphitheatre Parkway, Mountain View, CA", "450 Serra Mall, Stanford, CA 94305, USA", "DRIVE"]. 
  Travel mode can be "DRIVE", "WALK", "BICYCLE", "TRANSIT", "TWO_WHEELER".`;

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = {
      origin: {
        address: origin,
      },
      destination: {
        address: destination,
      },
      travel_mode,
    };

    let fieldMask =
      "routes.duration,routes.distanceMeters,routes.routeLabels,routes.description,routes.polyline";

    if (travel_mode === "TRANSIT") {
      fieldMask +=
        ",routes.legs.steps.transitDetails,routes.legs.stepsOverview";
    }

    if (travel_mode === "DRIVE" || travel_mode === "TWO_WHEELER") {
      fieldMask += ",routes.legs.steps";
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

    const routes = json.routes.map((route: Route) => {
      const legs = route.legs.map((leg: Leg) => {
        const steps = leg.steps
          ? leg.steps.map((step: Step) => ({
              distanceMeters: step.distanceMeters,
              staticDuration: step.staticDuration,
              polyline: step.polyline ? step.polyline.encodedPolyline : null,
              startLocation: {
                latitude: step.startLocation.latLng.latitude,
                longitude: step.startLocation.latLng.longitude,
              },
              endLocation: {
                latitude: step.endLocation.latLng.latitude,
                longitude: step.endLocation.latLng.longitude,
              },
              maneuver: step.navigationInstruction.maneuver,
              instructions: step.navigationInstruction.instructions,
              distanceText: step.localizedValues.distance.text,
              durationText: step.localizedValues.staticDuration.text,
              travelMode: step.travelMode,
            }))
          : [];

        return {
          steps,
        };
      });

      return {
        legs,
        distanceMeters: route.distanceMeters,
        duration: route.duration,
        polyline: route.polyline ? route.polyline.encodedPolyline : null,
        description: route.description,
        routeLabels: route.routeLabels,
      };
    });

    console.dir(routes, { depth: null });

    return JSON.stringify(routes);
  }
}
