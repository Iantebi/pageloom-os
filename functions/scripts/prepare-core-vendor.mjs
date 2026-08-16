import {cp, mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const functionsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const coreRoot = resolve(functionsRoot, "..", "packages", "core");
const destination = resolve(functionsRoot, "vendor", "core");
const sourcePackage = JSON.parse(await readFile(resolve(coreRoot, "package.json"), "utf8"));

await rm(destination, {recursive: true, force: true});
await mkdir(destination, {recursive: true});
await cp(resolve(coreRoot, "lib"), resolve(destination, "lib"), {recursive: true});
await cp(resolve(coreRoot, "src"), resolve(destination, "src"), {recursive: true});
await writeFile(resolve(destination, "package.json"), `${JSON.stringify({
  name: sourcePackage.name,
  version: sourcePackage.version,
  type: sourcePackage.type,
  main: sourcePackage.main,
  types: sourcePackage.types,
  exports: sourcePackage.exports,
  dependencies: sourcePackage.dependencies,
}, null, 2)}\n`);
