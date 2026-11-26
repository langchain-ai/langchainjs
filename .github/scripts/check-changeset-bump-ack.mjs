// Fails when a PR's changesets bump a package minor or major without the
// matching ack label: major needs `ci:ack-major`, minor needs `ci:ack-minor`
// (or `ci:ack-major`).
import { execFileSync } from "node:child_process";
import { parseChangesetFile } from "@changesets/parse";

const { BASE_SHA, HEAD_SHA, PR_LABELS = "[]" } = process.env;
const labels = new Set(JSON.parse(PR_LABELS).map((label) => label.name));

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

const files = git(
  "diff",
  "--name-only",
  "--diff-filter=d",
  `${BASE_SHA}...${HEAD_SHA}`,
  "--",
  ".changeset/*.md",
  ":!.changeset/README.md"
)
  .split("\n")
  .filter(Boolean);

const bumps = { major: [], minor: [] };
for (const file of files) {
  const { releases } = parseChangesetFile(git("show", `${HEAD_SHA}:${file}`));
  for (const { name, type } of releases) {
    bumps[type]?.push(`${name} (${file})`);
  }
}

function fail(type, label) {
  console.log(
    `::error::This PR has ${type} changesets but no \`${label}\` label.`
  );
  console.log(
    `${type} bumps:\n${bumps[type].map((bump) => `  - ${bump}`).join("\n")}`
  );
  console.log(
    `Add the \`${label}\` label to confirm the ${type} release is intended.`
  );
  process.exit(1);
}

if (bumps.major.length > 0 && !labels.has("ci:ack-major")) {
  fail("major", "ci:ack-major");
}
if (
  bumps.minor.length > 0 &&
  !labels.has("ci:ack-minor") &&
  !labels.has("ci:ack-major")
) {
  fail("minor", "ci:ack-minor");
}
console.log("Changeset bumps are acknowledged (or patch-only).");
