import { afterEach, describe, expect, it, vi } from "vitest";

const getToken = vi.fn();
vi.mock("firebase/app-check", () => ({ getToken }));
vi.mock("./firebase", () => ({
  firebaseAppCheck: { app: {} },
  firebaseAuth: { currentUser: { getIdToken: vi.fn().mockResolvedValue("id-token") } },
}));
vi.mock("./i18n", () => ({ t: () => ({ unexpectedResponse: vi.fn(), withoutContentType: "", requestFailed: "", fileRequestFailed: "" }) }));

afterEach(() => { vi.restoreAllMocks(); getToken.mockReset(); });

describe("custom API App Check attestation", () => {
  it("attaches the App Check token to JSON API requests", async () => {
    getToken.mockResolvedValue({ token: "app-check-token" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { ok: true } }), { status: 200, headers: { "content-type": "application/json" } })));
    const { api } = await import("./api");
    await api<{ ok: boolean }>("/me");
    expect(fetch).toHaveBeenCalledWith("/api/me", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer id-token", "X-Firebase-AppCheck": "app-check-token" }),
    }));
  });

  it("fails open in monitoring mode when App Check cannot issue a token", async () => {
    getToken.mockRejectedValue(new Error("unavailable"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { ok: true } }), { status: 200, headers: { "content-type": "application/json" } })));
    const { api } = await import("./api");
    await api<{ ok: boolean }>("/me");
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).not.toHaveProperty("X-Firebase-AppCheck");
  });
});
