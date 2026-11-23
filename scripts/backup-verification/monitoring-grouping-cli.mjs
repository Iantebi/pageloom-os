#!/usr/bin/env node
/**
 * Local file transform only (no network): node monitoring-grouping-cli.mjs <policy.json> <conditionDisplayName> <out.json>
 * Guards the snapshot, writes the grouped policy, prints the changed JSON paths. Exit 1 if the guard fails.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { changedPaths, groupedPolicy } from "./lib/monitoring-grouping.mjs";

const [input, condition, output] = process.argv.slice(2);
try {
  const before = JSON.parse(readFileSync(input, "utf8"));
  const after = groupedPolicy(before, condition);
  writeFileSync(output, JSON.stringify(after, null, 2));
  const paths = changedPaths({ ...before, creationRecord: undefined, mutationRecord: undefined }, after);
  console.log(`  ${before.displayName}: GUARD OK; changes -> ${paths.join(", ")}`);
} catch (error) {
  console.error(`  ${error.message}`);
  process.exit(1);
}
