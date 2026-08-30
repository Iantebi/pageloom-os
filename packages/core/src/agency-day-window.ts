export type AgencyDayWindow={startIso:string;endIso:string;dateKey:string};

// Computes the UTC instant boundaries of "today" as observed in the agency's configured IANA
// timezone (params.agencyTimezone, e.g. "Asia/Jerusalem") — the same locale/timezone technique
// already used for the daily CEO report's date key (functions/src/index.ts dailyCeoReport, via
// `new Date().toLocaleDateString("en-CA",{timeZone})`), generalized here into start/end instants
// so callers can run a Firestore range query (or an in-memory filter) over "today"'s records
// without naive UTC-midnight boundaries misclassifying records near the day edge.
export function agencyDayWindow(nowMs:number,timeZone:string):AgencyDayWindow{
  const now=new Date(nowMs);
  const parts=new Intl.DateTimeFormat("en-US",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).formatToParts(now).reduce((acc,part)=>{if(part.type!=="literal")acc[part.type]=part.value;return acc},{}as Record<string,string>);
  const hour=parts.hour==="24"?"00":parts.hour;
  const year=Number(parts.year),month=Number(parts.month)-1,day=Number(parts.day);
  // The offset between the zone's local wall-clock reading and the same instant expressed in UTC,
  // derived from the same `now` sample so it already reflects DST for this specific day.
  const offsetMs=Date.UTC(year,month,day,Number(hour),Number(parts.minute),Number(parts.second))-nowMs;
  const startOfDayMs=Date.UTC(year,month,day,0,0,0)-offsetMs;
  const endOfDayMs=startOfDayMs+24*60*60*1000;
  return{startIso:new Date(startOfDayMs).toISOString(),endIso:new Date(endOfDayMs).toISOString(),dateKey:`${parts.year}-${parts.month}-${parts.day}`};
}
