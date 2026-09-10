# Privacy Policy — Prisme.ai Browser Extension

_Last updated: 2026-09-10 (preview)_

The extension connects to the Prisme.ai instance **you configure** (the Platform
and API URLs you enter, or those pushed by your organization's policy). It has no
backend of its own and sends no data to Prisme.ai SAS or any third party.

## What it accesses

- **Current page content and your text selection** — read on the active tab to
  give the agent context, and only sent to your configured instance when you chat.
- **Page actions** (click / fill / navigate / snapshot / screenshot) — performed
  on the active tab only when the agent's tools request it, under the permission
  model of your instance.
- **Local configuration** — instance URLs, agent id and options, stored in the
  browser (`chrome.storage`) or provided by your organization's managed policy.

## Where data goes

Page context, selections and messages are sent **only** to the Prisme.ai instance
you configured, over its API, to produce the agent's responses. The session token
stays inside the widget iframe served by that instance. Nothing is collected,
stored, sold or shared by the extension itself.

## Permissions

See [STORE.md](STORE.md#6-justification-des-permissions-à-copier-dans-la-fiche)
for the per-permission justification. No remote code is bundled or executed.

## Contact

For questions about this extension, contact your Prisme.ai administrator or your
Prisme.ai representative.
