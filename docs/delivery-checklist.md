# Four-link delivery checklist

Deadline: Monday, August 31, 2026. Release owner: Canyon Smith.

## Link manifest

Fill this only after signed-out verification.

| Deliverable | Public URL | Release/version | Verified at | Status |
|---|---|---|---|---|
| 5–10 minute Loom | `TBD` | script in `docs/loom-storyboard.md` | `TBD` | ☐ |
| public GitHub repository | `https://github.com/grandcanyonsmith/redo-return-integrity` | commit `TBD` | `TBD` | ☐ |
| published Notion specification | `TBD` | source commit `TBD` | `TBD` | ☐ |
| live AWS prototype | `https://d1s8s6dxodk0qc.cloudfront.net` | `RedoReturnIntegrity-demo` | `2026-08-24 18:09 MDT` | ☑ infrastructure/UI; OpenAI provider billing blocked |

Do not mark complete from an authenticated-owner view. Test each exact URL in a private browser.

## GitHub acceptance

- [ ] repository is public under intended owner/name;
- [ ] MIT `LICENSE` is present;
- [ ] README accurately labels live, simulated, and proposed components;
- [ ] release commit is pushed and main branch displays it;
- [ ] GitHub Actions typecheck/test/build/synth and browser jobs pass at that commit;
- [ ] no secret, `.env`, personal email, AWS account ID, real shopper/label/ID, signed URL, or private artifact exists in history;
- [ ] `docs/` contains product, lifecycle, methodology, architecture, data, API, security, implementation, brand, sources, deployment, Loom, and runbook artifacts;
- [ ] relative file/source links work from GitHub;
- [ ] repository topic/description do not imply official Redo ownership.

## Live prototype acceptance

- [ ] CloudFront HTTPS URL loads while signed out;
- [ ] direct S3 objects are not publicly readable;
- [ ] `/api/health` works through the public origin;
- [ ] anonymous sessions are isolated and resettable;
- [ ] all 15 lifecycle nodes render/evaluate;
- [ ] three deep journeys pass end-to-end;
- [ ] OpenAI badge is truthful (`live`, unavailable, or fallback) and no browser key exists;
- [ ] no model/API/schema failure produces denial;
- [ ] no final denial without explicit human record;
- [ ] appeal supersedes and preserves prior decision;
- [ ] `EVIDENCE_READY != SUBMITTED` in UI/state;
- [ ] upload path allows only JPEG, PNG, WebP ≤5 MiB; uses a 60-second exact-byte/checksum POST; requires S3 version completion; rejects cross-purpose evidence; preserves first-completion provenance; exposes no inline image source; and mints only fresh 300-second exact-version preview/model URLs;
- [ ] image-label confidence below `0.75` selects no record, and identifiers resolving to different records fail closed rather than selecting one;
- [ ] return lookup visibly separates requested refund/currency from eligible catalog value and exposes the policy ID, policy version, and verified snapshot SHA-256 used by deterministic refund math;
- [ ] inspection and draft outputs carry model audit metadata; draft carries `contentSha256`; review requires `draftDecision:"APPROVE_AS_WRITTEN"` against the exact context/evidence/hash; queue recomputes the hash and persists it in the delivery-disabled outbox;
- [ ] a second session cannot read another session's completed evidence/inspection/draft/review/outbox; separately disclose that the five globally keyed return profiles and twenty aliases are synthetic fixtures, not proof of tenant isolation;
- [ ] waitlist requires consent, persists/dedupes, and sends no email;
- [ ] responsive at 390px, 768px, and desktop; keyboard/focus/reduced-motion checked;
- [ ] CloudWatch shows no unexpected errors/throttles or sensitive logs;
- [ ] OpenAI session/day budgets are enforced.
- [ ] upload-policy budgets (12/session and 120/day) are enforced without reset bypass.

## Notion acceptance

- [ ] exact public page works without login;
- [ ] candidate/not-official disclosure is above the fold;
- [ ] `$80M`/`$200M` are labeled scenario inputs and nonadditive;
- [ ] product layers, requirements, market context, KPIs, schema, architecture, dependencies, timeline, time to revenue, pricing, and risks are present;
- [ ] lifecycle matrix includes all checkpoints/data/actions/cures;
- [ ] causal method and worked examples are present;
- [ ] citations link to direct source pages;
- [ ] brand section is labeled extrapolation;
- [ ] diagrams have readable fallback;
- [ ] source Git commit is listed.

## Loom acceptance

- [ ] 5–10 minutes (target ~8);
- [ ] 1080p/readable text and clear audio;
- [ ] no notifications, bookmarks, account IDs, email, secret, console, or private tab exposed;
- [ ] demonstrates all three journeys, not just slides;
- [ ] calls out live versus simulator versus fallback;
- [ ] says human-only final adverse action;
- [ ] says challenge noncompletion is not fraud;
- [ ] distinguishes `$80M` managed physical evidence from `$200M` broader scenario;
- [ ] distinguishes stopped, estimated deterrence, unresolved, recovered, labor, and protected;
- [ ] says evidence-ready is not processor-submitted;
- [ ] link works signed out and starts from beginning with captions if available.

## Cross-link acceptance

- [ ] README links live app, Notion, Loom, and docs;
- [ ] Notion links GitHub release/source and live app;
- [ ] Loom description links GitHub, Notion, and live app;
- [ ] live app footer links repository and specification only after URLs are final;
- [ ] all four use the same product name, release date, merchant disclosure, and metric definitions.

## Final email template

Subject: `Redo Return Integrity — Senior Software Engineer demo`

> Jesse,
>
> Thank you again for the conversation. I built Redo Return Integrity as a Senior Software Engineer candidate proposal focused first on empty, decoy/wrong-item, possible-imitation, and quantity-mismatch returns.
>
> Here are the four deliverables:
>
> 1. Loom walkthrough — [link]
> 2. TypeScript/React/AWS repository — [link]
> 3. Product, measurement, and implementation specification — [link]
> 4. Live shopper, merchant, and warehouse prototype — [link]
>
> The prototype uses synthetic commerce, carrier, identity, warehouse, and Reclaim adapters. The live AWS/OpenAI states are labeled in the UI. The design keeps final adverse decisions human-owned, gives shoppers a concrete cure/appeal path, and measures prevention causally rather than counting non-verification as fraud.
>
> I would be glad to walk through the engineering tradeoffs, the warehouse ground-truth loop, or how I would stage an Evidence & Observe pilot into a defensible Pro product.
>
> Best,  
> Canyon

## Release record

Record without secrets:

```text
Git commit:
GitHub Actions run:
CDK stack:
AWS region: us-west-2
CloudFront distribution URL:
OpenAI model shown by release:
Notion source version:
Loom duration:
Signed-out verifier/time:
Known limitations:
```
