import{describe,expect,it}from"vitest";
import{parseVerifiedDeploymentUrl}from"./deployment-record.js";

describe("parseVerifiedDeploymentUrl",()=>{
  it("normalizes a verified HTTPS deployment URL",()=>{
    expect(parseVerifiedDeploymentUrl('{"url":"https://example.web.app"}')).toBe("https://example.web.app/");
  });
  it.each(["not json",'{"url":"http://example.test"}','{"url":42}'])("rejects unsafe or malformed deployment evidence",content=>{
    expect(parseVerifiedDeploymentUrl(content)).toBeUndefined();
  });
});
