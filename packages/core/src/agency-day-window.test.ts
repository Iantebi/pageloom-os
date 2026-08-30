import{describe,expect,it}from"vitest";import{agencyDayWindow}from"./agency-day-window.js";
describe("agency day window",()=>{
  it("computes a UTC-anchored day window with no offset",()=>{
    const window=agencyDayWindow(Date.parse("2026-08-29T14:00:00Z"),"UTC");
    expect(window).toMatchObject({dateKey:"2026-08-29",startIso:"2026-08-29T00:00:00.000Z",endIso:"2026-08-30T00:00:00.000Z"});
  });
  it("shifts the window forward for a timezone ahead of UTC (Israel Daylight Time, UTC+3)",()=>{
    // 2026-08-29T22:30:00Z is 2026-08-30T01:30 in Asia/Jerusalem (summer, UTC+3) — already the next local day.
    const window=agencyDayWindow(Date.parse("2026-08-29T22:30:00Z"),"Asia/Jerusalem");
    expect(window).toMatchObject({dateKey:"2026-08-30",startIso:"2026-08-29T21:00:00.000Z",endIso:"2026-08-30T21:00:00.000Z"});
  });
  it("keeps the same local day near the start of the Israel-timezone morning",()=>{
    const window=agencyDayWindow(Date.parse("2026-08-29T04:00:00Z"),"Asia/Jerusalem");
    expect(window.dateKey).toBe("2026-08-29");
    expect(Date.parse(window.startIso)).toBeLessThanOrEqual(Date.parse("2026-08-29T04:00:00Z"));
    expect(Date.parse(window.endIso)).toBeGreaterThan(Date.parse("2026-08-29T04:00:00Z"));
  });
  it("produces a 24-hour window",()=>{
    const window=agencyDayWindow(Date.now(),"Asia/Jerusalem");
    expect(Date.parse(window.endIso)-Date.parse(window.startIso)).toBe(24*60*60*1000);
  });
});
