import { GenericContainer, Wait } from "testcontainers";
import { isUsingLocalAtlas } from "./src/tests/utils";

export default async function setup() {
    if (!isUsingLocalAtlas()) return;

    const container = await new GenericContainer("mongodb/mongodb-atlas-local")
        .withExposedPorts({ host: 27017, container: 27017 })
        .withEnvironment({
            // `mongot` logs otherwise don't get written to the container log, which we 
            // need for the wait strategy
            MONGOT_LOG_FILE: "/dev/stdout",
        })
        .withWaitStrategy(Wait.forLogMessage(/starting on .*27027/).withStartupTimeout(30_000))
        .start();

    globalThis.__container = container;
}