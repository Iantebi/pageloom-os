import { describe, expect, it } from "vitest";
import { relativePath } from "./tool-gateway.js";

describe("CRM tool path SSRF guard", () => {
  it("accepts plain relative paths", () => {
    expect(relativePath.parse("/customers/123")).toBe("/customers/123");
    expect(relativePath.parse("customers/123")).toBe("customers/123");
  });
  it("rejects absolute URLs that would bypass CRM_BASE_URL", () => {
    expect(() => relativePath.parse("https://evil.example/steal")).toThrow();
    expect(() => relativePath.parse("http://evil.example/steal")).toThrow();
  });
  it("rejects protocol-relative URLs that would bypass CRM_BASE_URL", () => {
    expect(() => relativePath.parse("//evil.example/steal")).toThrow();
  });
  it("rejects other URL schemes", () => {
    expect(() => relativePath.parse("file:///etc/passwd")).toThrow();
    expect(() => relativePath.parse("javascript://alert(1)")).toThrow();
  });
  it("rejects backslash paths that some URL parsers normalize into protocol-relative URLs", () => {
    expect(() => relativePath.parse("\\\\evil.example/steal")).toThrow();
  });
});
