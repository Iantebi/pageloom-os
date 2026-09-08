/**
 * Minimal, safe execution of the command descriptors built by gcloud-commands.mjs. Uses
 * execFileSync (never a shell string), so no argument - a project id, bucket name, or
 * export date - can ever be interpreted as shell syntax.
 */
import { execFileSync } from "node:child_process";

export function runCommand({ command, args }) {
  return execFileSync(command, args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

export function runJson(descriptor) {
  return JSON.parse(runCommand(descriptor));
}
