# Business operations model

PageLoom calculates executive finance from persisted revenue and expense ledgers. Empty ledgers produce zero values; the dashboard never invents commercial data.

## Supported KPIs

- Revenue and expenses
- Gross and net profit
- Monthly and annual recurring revenue
- Customer lifetime value using an explicit lifetime assumption
- Cost per active customer
- Hosting, AI, and domain cost
- Cashflow
- Project profitability

Every entry contains amount, ISO currency, occurrence time, category, recurring status, and optional customer/project references. Revenue and expense writes require owner or administrator authority.

Pricing packages support Basic, Standard, and Premium tiers; setup fees; monthly subscription; hosting; maintenance; add-ons; term length; and explicit percentage discounts. Sending a proposal or accepting payment remains an owner-approved external action.

Do not aggregate mixed currencies without an explicit exchange-rate record. Pipeline is never recognized as revenue, and forecasts remain separate from accounting results.
