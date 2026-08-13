export function openAiFallbackEnabled(value:string|undefined){return value?.trim().toLowerCase()==="true"}
export function providerHealthForMode(fallbackEnabled:boolean){return{gemini:true,openai:fallbackEnabled}as const}
