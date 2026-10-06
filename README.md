# n8n-nodes-admaxxer

This is an n8n community node. It lets you use [Admaxxer](https://admaxxer.com) in your n8n workflows.

Admaxxer is marketing analytics: revenue attribution, web analytics, and ad spend and ROAS across Meta, Google and TikTok, in one workspace. This node reads it, so your workflows can report, alert and summarise without opening the dashboard. It never changes a campaign.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)
[Operations](#operations)
[Credentials](#credentials)
[Compatibility](#compatibility)
[Usage](#usage)
[Resources](#resources)
[Version history](#version-history)

## Installation

In n8n, open **Settings → Community Nodes → Install**, enter `n8n-nodes-admaxxer` and install. The full steps are in n8n's [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Operations

Every operation is read-only.

| Resource | Operation | What it returns |
|---|---|---|
| Analytics | Get Summary | Total sales, net profit, blended spend, blended ROAS, MER, orders, AOV, new vs returning customers, sessions and visitors for a date range |
| Analytics | Get Attribution | Revenue, spend, ROAS, orders and CPA per channel under any of 8 attribution models (first click, last click, last non-direct click, linear, linear paid, time decay, position based, reconciled) |
| Analytics | Get Web Analytics | Unique visitors, new users, sessions, pageviews, pages per session, bounce rate, average session duration and conversion rate for a tracked website |
| Analytics | Get Audience | Age and gender split of the people your Meta and Google ads reached |
| Analytics | Get AI Search Visibility | How often your brand appears in AI search answers |
| Analytics | Get AI Citations | Where AI assistants cite your site |
| Ad Account | Get Many | Connected Meta, Google, TikTok, Shopify and Klaviyo accounts (one item each) |
| Ad Account | Get Insights | The ad platform's delivery numbers for one ad account, such as spend and impressions, for the date range |
| Campaign | Get Many | Campaigns in an ad account with spend, revenue, ROAS and conversions for the date range (one item each) |
| Campaign | Get Insights | The ad platform's delivery numbers for one campaign for the date range |
| Alert | Get Many | Your alert rules and the alerts that fired recently |
| Workspace | Get | The workspace the token reads, its scopes, plan and connections |

Dates default to the last 7 days. Money comes back in the workspace's display currency, in major units (dollars, not cents).

The node can also be used as a tool by n8n's AI Agent node, so an agent can answer "what was our ROAS on Meta last week?" from live numbers.

## Credentials

1. Sign in at [admaxxer.com](https://admaxxer.com) and connect at least one ad account or tracked website.
2. Open **Integrations → MCP** and create a token. A **read-only** token is all this node needs.
3. In n8n, add an **Admaxxer API** credential and paste the token. **Test** reads your workspace name and changes nothing.

## Compatibility

Built with `@n8n/node-cli` 0.51 for the n8n 1.x and 2.x node API (`n8nNodesApiVersion` 1). Tested against n8n 2.42.3. No runtime dependencies.

## Usage

**Pick the ad account from a list.** Campaign and Ad Account operations load your connected accounts into a dropdown. Use an expression instead to pass an ID from an earlier step.

**A weekly report.** Schedule Trigger (Mondays 9:00) → Admaxxer *Get Summary* → Admaxxer *Get Attribution* → send the numbers to Slack or email.

**A spend alert.** Schedule Trigger (hourly) → Admaxxer *Campaign → Get Many* → IF `roas < 1` and `spend > 50` → notify.

**When a request is refused**, the error shows Admaxxer's message and the fix it suggests.

## Example workflows

Import any of these in n8n (**Workflows → Import from File**), then pick your credential in each node:

* [Alert on campaigns spending without return, from Admaxxer](examples/campaign-roas-alert.json)
* [Weekly marketing KPI and attribution report from Admaxxer](examples/weekly-kpi-report.json)

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Connect any AI to Admaxxer](https://admaxxer.com/documentation/connect-any-ai)
* [Admaxxer documentation](https://admaxxer.com/documentation)

## Version history

### 0.1.0

First release: Analytics, Ad Account, Campaign, Alert and Workspace reads.
