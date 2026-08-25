# Demo runbook

## Objective

Prove three end-to-end claims:

1. a legitimate shopper can clear targeted checkout doubt without being labeled fraudulent;
2. impossible reverse logistics can be resolved or escalated with new evidence;
3. managed physical evidence can identify an empty/decoy/wrong/quantity discrepancy while keeping model, policy, human decision, appeal, and Reclaim states separate.

## Preflight (30–45 minutes before)

- run `npm run verify` and `npm run test:e2e` at the release commit;
- verify GitHub Actions at the same commit;
- open the CloudFront URL in a private window;
- call `/api/health` through CloudFront, not the direct API URL;
- confirm CloudFront/API headers and no mixed content;
- confirm live/fallback model badge accurately reflects current OpenAI path;
- in Return intake, verify the structured output includes model audit metadata and never call `SAFE_FALLBACK` a successful provider result;
- check Lambda errors/throttles/latency and daily budget;
- test reset in one private window and isolation in a second;
- submit only a controlled waitlist test address; confirm “no email sent” copy;
- verify Notion and Loom/GitHub visibility while signed out;
- turn off notifications and close sensitive tabs.

## Fixture truth

- merchant: Juniper Circuit, fictional high-AOV electronics;
- all shopper/order/carrier/payment/warehouse/payment-dispute data: synthetic;
- all built-in imagery is synthetic; the optional camera path becomes session-scoped demo evidence only after exact-version checksum, purpose, MIME-signature, size, and magic-byte completion succeeds;
- the upload POST authorization lasts 60 seconds; any evidence preview/model URL is separately minted for 300 seconds against the exact completed version and is never persisted;
- nonfixture tools accept no inline image source: label lookup requires completed `RETURN_LABEL` evidence and package analysis requires completed `PACKAGE_CONTENTS` evidence;
- the five return profiles and twenty exact aliases are globally keyed synthetic fixtures. Anonymous sessions isolate captured evidence and downstream work, but the seed lookup is not tenant authorization and must never contain real merchant/shopper data;
- Shopify, payment, carrier, identity, WMS, and Reclaim: typed simulators;
- OpenAI: live only when server secret/model request succeeds; otherwise safe fallback;
- no refund, denial, email, ID verification, chargeback, or processor submission occurs outside the demo state.

## Journey A — good actor checkout

Start: fresh session → Shopper.

Expected sequence:

1. show checkpoint evidence and narrow reason;
2. choose an alternate verification path;
3. complete it;
4. show `PASS`/`PASS_MONITORED` and active order;
5. point out separate completion/decline/abandonment/technical states.

Acceptance:

- no “fraud” label from non-completion;
- challenge names purpose, time, alternatives, and support;
- no real ID capture;
- model cannot output `DENY`;
- good actor can proceed.

## Journey B — reverse-logistics contradiction

Start: Shopper → logistics case.

Expected sequence:

1. show native carrier events;
2. show deterministic 620-mile/18-minute contradiction;
3. model summarizes with carrier-error alternative;
4. choose synthetic staffed receipt;
5. new evidence appears with source/time;
6. new decision supersedes prior hold/request;
7. clear or route to carrier trace/review.

Acceptance:

- deterministic code owns time/distance;
- missing/out-of-order scan does not auto-deny;
- new evidence does not mutate history;
- shopper has receipt, lookup, explanation, and review alternatives.

## Journey C — physical return

Start: Operator → RMA fixture.

Expected sequence:

1. confirm calibrated scale/protocol/device labels;
2. open **Return intake** and scan the synthetic label; show that confidence must be at least `0.75`, conflicting aliases select no record, and the matched record separates requested refund/currency from eligible catalog value with policy ID/version/snapshot hash;
3. capture/select exterior, opening, contents, quantity/serial views; nonfixture package capture must first complete as `PACKAGE_CONTENTS` evidence;
4. choose empty, decoy/wrong, quantity mismatch, or inconclusive branch and evaluate;
5. show exact evidence references, missing information, strict structured output, and model audit metadata;
6. show deterministic recommendation math capped at the lower of requested refund and eligible total;
7. generate a `DRAFT_NOT_SENT` communication and compare catalog reference with warehouse provenance; show its `contentSha256`;
8. record `APPROVE_AS_WRITTEN` with all acknowledgments and the exact evidence set, then queue only to `QUEUED_TEST_OUTBOX`; show the same draft hash and `deliveryDisabled:true`;
9. open Merchant and compare model recommendation with policy; request evidence/hold/review or perform clearly labeled human decision;
10. show shopper cure/deadline;
11. appeal/new evidence supersedes the decision where demonstrated;
12. show evidence packet state as `EVIDENCE_READY`, never submitted.

Acceptance:

- missing capture/low image quality can abstain;
- possible imitation is not called counterfeit;
- operator is not primed with an accusation;
- final denial requires explicit human rationale/evidence/appeal;
- money tiles distinguish held, verified stopped, recovered, and protected.
- cross-purpose evidence is rejected before a model call, and no inline image field can bypass completion;
- the reviewer display label is described as unauthenticated rather than identity proof;
- queueing fails if draft content, hash, context, or evidence binding changes.

## Evaluation lab

Show:

- `$80M` and `$200M` as nonadditive scenario cohorts;
- methodology/definition disclosure;
- treatment-control mature loss, not challenge noncompletion;
- legitimate friction beside loss estimate;
- first-stopped stage attribution;
- illustrative/synthetic labeling.

Say explicitly: “These figures do not represent verified Redo revenue or a forecast.”

## Failure rehearsals

| Failure | Expected demo behavior |
|---|---|
| OpenAI key missing/API timeout | fallback badge; deterministic evidence remains; human review; no denial |
| evaluation quota | clear `429`/limit message; state preserved |
| upload input/purpose/version invalid | reject and list allowed JPEG/PNG/WebP + 5 MB; a successful 60-second presign remains “not evidence” until exact-version completion; cross-purpose consumption is rejected; 300-second previews are read-only and exact-version scoped |
| label confidence `<0.75` or identifiers point to different records | select no return; show warning and manual-confirmation path |
| draft/review hash or evidence context mismatch | reject queueing; preserve `DRAFT_NOT_SENT`; no contact side effect |
| offline/API down | UI visibly says preview/fallback; no waitlist saved |
| duplicate waitlist | idempotent accepted/already-recorded response; no email |
| stale session | create/reset session; never expose another session |
| carrier/identity technical failure | alternate path/review; failure not fraud |

## Responsive/accessibility check

- 390×844: menu, hero, all primary journeys, evidence preview, forms, action controls;
- 768×1024: cards/pipeline reflow without overlap;
- 1440×900: intended recording view;
- keyboard through nav, forms, upload trigger, pipeline, action dialog, reset;
- visible focus and labeled status;
- reduced motion check;
- zoom 200% and no essential clipped content.

## Recovery during presentation

- If a live call fails, say: “The safe fallback is the product behavior: the system preserves deterministic facts and routes to review rather than manufacturing confidence.” Continue with the visible fallback.
- If state is wrong, use Reset; do not manipulate DynamoDB/AWS on camera.
- If time is short, skip optional UI detail but preserve the measurement, adverse-action, and Reclaim distinctions.
- If a public link fails, use local build only as backup and disclose it; do not claim the public acceptance test passed.

## Post-demo verification

- confirm no sensitive upload was used;
- inspect CloudWatch for unexpected error/PII without copying raw logs;
- remove controlled waitlist test record only through an approved exact-target operation if needed;
- preserve release commit, CI result, CloudFormation output names, and signed-out link checks in delivery notes.
