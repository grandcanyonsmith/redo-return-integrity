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
- check Lambda errors/throttles/latency and daily budget;
- test reset in one private window and isolation in a second;
- submit only a controlled waitlist test address; confirm “no email sent” copy;
- verify Notion and Loom/GitHub visibility while signed out;
- turn off notifications and close sensitive tabs.

## Fixture truth

- merchant: Juniper Circuit, fictional high-AOV electronics;
- all shopper/order/carrier/payment/warehouse/payment-dispute data: synthetic;
- all demonstrated decision evidence imagery: synthetic fixtures; the local file picker/presign route is a non-evidence scaffold only;
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
2. capture/select exterior, opening, contents, quantity/serial views;
3. choose empty, decoy/wrong, quantity mismatch, or inconclusive branch;
4. evaluate;
5. show exact evidence references and missing information;
6. open Merchant and compare model recommendation with policy;
7. request evidence/hold/review or perform clearly labeled human decision;
8. show shopper cure/deadline;
9. appeal/new evidence supersedes the decision where demonstrated;
10. show evidence packet state as `EVIDENCE_READY`, never submitted.

Acceptance:

- missing capture/low image quality can abstain;
- possible imitation is not called counterfeit;
- operator is not primed with an accusation;
- final denial requires explicit human rationale/evidence/appeal;
- money tiles distinguish held, verified stopped, recovered, and protected.

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
| upload scaffold input invalid | reject and list allowed JPEG/PNG/WebP + 5 MB; a successful presign still must say “not evidence” |
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
