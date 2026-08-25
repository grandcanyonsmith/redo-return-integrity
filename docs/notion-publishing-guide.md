# Notion publishing guide

The repository is the version-controlled source. The Notion deliverable is a reader-friendly publication of the same content, not a second untracked specification.

## Recommended page tree

Create one top-level page:

**Redo Return Integrity — Product, Evidence, and Implementation Plan**

At the top include:

```text
Candidate proposal — not an official Redo roadmap
Prepared by Canyon Smith
Source version: Git commit __________
Prepared: August 24, 2026
Demo target: August 31, 2026
```

Recommended child pages in this order:

1. **Executive product specification** — `product-spec.md`
2. **15-checkpoint lifecycle decision matrix** — `lifecycle-decision-matrix.md`
3. **Measurement methodology and worked examples** — `measurement-methodology.md`
4. **Architecture and decision flows** — `architecture.md`
5. **Data dictionary** — `data-dictionary.md`
6. **HTTP API contract** — `api.md`
7. **Security, privacy, and responsible decisioning** — `security-privacy.md`
8. **Production implementation and time to revenue** — `implementation-plan.md`
9. **Brand/design extrapolation** — `brand-design-guide.md`
10. **Sources and qualification** — `sources.md`

Put the Loom storyboard, demo runbook, deployment guide, and link checklist in the GitHub repository rather than the executive Notion navigation unless Jesse asks for delivery mechanics.

## Import procedure

1. Record the release commit.
2. In Notion, create a private staging page.
3. Import/copy the Markdown files in the order above.
4. Convert relative repository links to the corresponding Notion subpage or final public GitHub source link.
5. Render Mermaid blocks as a static SVG/PNG plus keep the Mermaid source in a toggle/code block. Notion support varies; never publish a blank diagram.
6. Keep source links adjacent to market/product claims.
7. Preserve tables; if a lifecycle table is too wide, retain the per-checkpoint sections and use the table only as an index.
8. Add a table of contents and “Read this first” callout summarizing human-only adverse action, nonresponse-not-fraud, and scenario qualification.

## Mandatory “Read this first” callout

> This is an independent candidate proposal, not an official Redo roadmap. All Juniper Circuit data and partner integrations are synthetic except the live AWS/OpenAI paths explicitly labeled in the prototype. The `$80M` managed-warehouse and `$200M` broader-surface values are supplied planning scenarios whose accounting definitions require Redo validation; they are not additive and are not treated as Redo revenue. OpenAI recommends bounded next steps but never makes a final adverse decision. Challenge noncompletion is not fraud. Evidence-ready is not submitted to a processor.

## Publication settings

- publish read-only;
- disable editing for public visitors;
- decide intentionally whether comments and duplication are permitted;
- do not expose workspace members, private parent pages, or unrelated navigation;
- do not require a Notion login for Jesse's delivery link;
- use a clean page title and cover only if it does not imply official Redo ownership;
- do not enable Notion AI processing of sensitive content; all current content is synthetic/public.

## Signed-out acceptance

Open the exact final URL in a private browser where no Notion account is logged in.

Verify:

- page loads without access request;
- all ten sections/subpages are reachable;
- tables and callouts render on mobile;
- diagrams have readable static fallback;
- external sources and GitHub links work;
- no “draft,” placeholder, secret, account ID, email, signed upload URL, private Drive link, or internal Notion breadcrumb appears;
- page states the source Git commit and August 24/August 31 dates;
- search within page finds: `human`, `noncompletion`, `EVIDENCE_READY`, `$80M`, `$200M`, `time to revenue`, `OpenAI`, and `appeal`.

## Change control

- Material edits happen in repository Markdown first.
- Update Notion and source commit together.
- Add a one-line revision note with date and commit.
- If Notion and GitHub differ, GitHub at the stated commit is authoritative.
- Re-run signed-out acceptance after any permission or content change.

## If Notion cannot be published

Do not silently substitute a private or broken page. The GitHub `docs/product-spec.md` is a readable backup, but the four-link promise remains incomplete until a separately accessible document URL is tested. Report the blocker plainly and supply the repository source while it is resolved.
