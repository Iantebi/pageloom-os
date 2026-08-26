# PageLoom published-content runtime

Every customer website must be configured with its own immutable PageLoom identifiers:

```env
NEXT_PUBLIC_PAGELOOM_API_BASE=https://pageloom-os-production.web.app
NEXT_PUBLIC_PAGELOOM_ORGANIZATION_ID=<organization-id>
NEXT_PUBLIC_PAGELOOM_WEBSITE_ID=<website-id>
```

Use the shared runtime at the website's server or build boundary:

```ts
import { loadPublishedWebsiteContent } from "@pageloom/core";
import existingContent from "./content.json";

export const content = await loadPublishedWebsiteContent({
  baseUrl: process.env.NEXT_PUBLIC_PAGELOOM_API_BASE!,
  organizationId: process.env.NEXT_PUBLIC_PAGELOOM_ORGANIZATION_ID!,
  websiteId: process.env.NEXT_PUBLIC_PAGELOOM_WEBSITE_ID!,
  fallback: existingContent,
});
```

The public endpoint reads only `content/published`. Drafts, submissions, permissions, and revision records are never included. Valid published fields overlay the site's existing content so rollout can be gradual. When the PageLoom endpoint is temporarily unavailable, the loader returns the supplied existing content instead of blanking the website.

Uploaded media remains private in Firebase Storage. The public content response converts only media paths referenced by that website's published document into short-lived read URLs. A website cannot request another website's content or media through its configured identifiers.

Recommended production caching is five minutes with stale-while-revalidate. Published content responses already emit matching cache headers. Sites that need immediate propagation after publish should revalidate or redeploy from the `website_content.published` activity event.
