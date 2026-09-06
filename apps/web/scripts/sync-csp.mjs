import{createHash}from"node:crypto";import{readFileSync,readdirSync,statSync,writeFileSync}from"node:fs";import{dirname,join,resolve}from"node:path";import{fileURLToPath}from"node:url";
const webRoot=resolve(dirname(fileURLToPath(import.meta.url)),".."),out=join(webRoot,"out"),firebasePath=resolve(webRoot,"../../firebase.json");
function files(dir){return readdirSync(dir).flatMap(name=>{const path=join(dir,name);return statSync(path).isDirectory()?files(path):path.endsWith(".html")?[path]:[]})}
const hashes=new Set();for(const file of files(out)){const html=readFileSync(file,"utf8");for(const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)){const body=match[1]??"";if(body)hashes.add(`'sha256-${createHash("sha256").update(body).digest("base64")}'`)}}
const firebase=JSON.parse(readFileSync(firebasePath,"utf8")),headers=firebase.hosting.headers??[],rule=headers.find(item=>item.source==="**"),csp=rule?.headers?.find(item=>item.key==="Content-Security-Policy");if(!csp)throw new Error("Firebase Hosting Content-Security-Policy header is missing");
// https://www.gstatic.com/https://www.google.com are for Firebase App Check's ReCaptchaV3Provider
// (see apps/web/src/lib/firebase.ts) - kept here, not just hand-edited into firebase.json, because
// this script regenerates the whole script-src value on every build and would otherwise silently
// drop them on the next `npm run build`. App Check itself only activates when
// NEXT_PUBLIC_APP_CHECK_SITE_KEY is set, so this is a no-op allowance until then.
csp.value=csp.value.replace(/script-src [^;]+;/,`script-src 'self' ${[...hashes].sort().join(" ")} https://apis.google.com https://www.gstatic.com https://www.google.com;`);
writeFileSync(firebasePath,`${JSON.stringify(firebase,null,2)}\n`);console.log(`Synchronized ${hashes.size} inline script hashes across ${files(out).length} HTML files.`);
