export function openAiFallbackEnabled(value:string|undefined){return value?.trim().toLowerCase()==="true"}
export function providerHealthForMode(preferred:"openai"|"gemini",fallbackEnabled:boolean){return preferred==="openai"?{openai:true,gemini:fallbackEnabled}as const:{gemini:true,openai:fallbackEnabled}as const}
