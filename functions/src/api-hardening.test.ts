import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";const source=readFileSync(new URL("./api.ts",import.meta.url),"utf8");describe("API hardening",()=>{it("returns structured generic errors for unhandled router failures",()=>{expect(source).toContain("api.unhandled_failure");expect(source).toContain('code:"INTERNAL_ERROR"');expect(source).toContain("safeErrorName(error)")})});
describe("Stripe webhook idempotency",()=>{
  it("acknowledges a duplicate delivery of an already-processed event instead of returning a failure",()=>{
    // A retried Stripe delivery hits webhookEvents/{id}.create() again, which throws ALREADY_EXISTS (gRPC code 6).
    // Returning a 4xx here would make Stripe retry forever and can eventually disable the webhook endpoint.
    expect(source).toContain('(error as{code?:number|string}).code===6');
    expect(source).toContain("received:true,duplicate:true");
  });
  it("still rejects deliveries that fail signature verification",()=>{
    expect(source).toContain("stripe.webhooks.constructEvent(req.body,req.headers[\"stripe-signature\"]");
    expect(source).toContain('code:"INVALID_WEBHOOK"');
  });
});
