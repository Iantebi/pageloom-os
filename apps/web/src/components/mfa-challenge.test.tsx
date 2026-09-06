import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ completeMfaSignIn: async () => {}, cancelMfaSignIn: () => {} }),
}));

describe("MfaChallenge", () => {
  it("renders the second-factor prompt without throwing", async () => {
    const { MfaChallenge } = await import("./mfa-challenge");
    expect(() => renderToStaticMarkup(<MfaChallenge />)).not.toThrow();
  });

  it("shows the Hebrew challenge copy and a cancel path back to sign-in", async () => {
    const { MfaChallenge } = await import("./mfa-challenge");
    const html = renderToStaticMarkup(<MfaChallenge />);
    expect(html).toContain("אימות דו-שלבי נדרש");
    expect(html).toContain("חזרה לכניסה");
  });
});
