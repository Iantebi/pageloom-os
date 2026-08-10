import {describe,expect,it} from "vitest";
import {getToolPolicy} from "./tool-policy.js";

describe("integration policy",()=>{
  it("requires approval for every protected CEO action",()=>{expect(getToolPolicy("stripe","invoice_draft","finance").approval).toBe("always");expect(getToolPolicy("whatsapp","send","support").approval).toBe("always");expect(getToolPolicy("gmail","send","client-journey").approval).toBe("always");expect(getToolPolicy("n8n","execute","automation").approval).toBe("always");expect(getToolPolicy("gcp","cloud_build","deployment").approval).toBe("always")});
  it("denies tools outside the single-responsibility mandate",()=>{expect(()=>getToolPolicy("stripe","refund","content")).toThrow();expect(()=>getToolPolicy("gcp","cloud_build","frontend-builder")).toThrow()});
  it("allows drafts and reads without executing customer contact",()=>{expect(getToolPolicy("whatsapp","draft","support").sideEffect).toBe(false);expect(getToolPolicy("crm","read","sales").approval).toBe("never")});
});
