// Cloud Functions sets FUNCTIONS_EMULATOR="true" only when running under the Firebase emulator
// suite. Any other value (including unset, which is what a real deployed function sees) is
// treated as production so an unrecognized/ambiguous runtime never accidentally relaxes the
// AI_EXECUTION_MODE guardrail in ai-execution-mode.ts.
export function isProductionRuntime():boolean{return process.env.FUNCTIONS_EMULATOR!=="true"}
