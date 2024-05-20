import { describe, expect } from "@jest/globals";
import { GoogleRoutesAPI } from "../google_routes.js";

describe.skip("GooglePlacesAPI", () => {
  test("should be setup with correct parameters", async () => {
    const instance = new GoogleRoutesAPI();
    expect(instance.name).toBe("google_routes");
  });

  test("GooglePlacesAPI returns expected result for valid query", async () => {
    const tool = new GoogleRoutesAPI();

    const result = await tool.invoke({
      origin: "Big Ben, London, UK",
      destination: "Buckingham Palace, London, UK",
      travel_mode: "WALK",
      computeAlternativeRoutes: false,
    });

    expect(result).toContain("Birdcage Walk");
  });

  test("GoogleRoutesAPI returns 'Invalid route. The route may be too long or impossible to travel by the selected mode of transport.' for route on an non-existent place or one that is too far", async () => {
    const tool = new GoogleRoutesAPI();

    const result = await tool.invoke({
      origin: "Sao Paulo, Brazil",
      destination: "New York, USA",
      travel_mode: "DRIVE",
      computeAlternativeRoutes: false,
    });

    expect(result).toContain(
      "Invalid route. The route may be too long or impossible to travel by the selected mode of transport."
    );
  });
});
