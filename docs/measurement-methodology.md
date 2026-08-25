# Measurement methodology: what was observed, estimated, prevented, recovered, or transferred

The measurement system is designed to stop the most common failure in fraud analytics: treating a risk score, challenge abandonment, merchant allegation, or amount placed on hold as a confirmed prevented loss.

All reports must state the unit, eligible cohort, denominator, currency, observation window, evidence tier, policy/model version, and whether the number is native, derived, experimental, or a hypothesis.

## Required outcome ledger

| Metric | What it means | What it is not |
|---|---|---|
| Eligible exposure | refund/order value that met a pre-registered intervention rule | expected loss or Redo revenue |
| Amount challenged/held | value paused while uncertainty is resolved | prevented fraud |
| Verified policy-ineligible value stopped | requested payout not issued after supported physical/objective evidence, human review, appeal window, and outcome maturity | proof of shopper intent; incremental causal effect |
| Experimental estimated loss avoided | treatment-control difference in mature realized loss, scaled to a declared cohort | count of abandoners × order value |
| Unresolved exposure | held or disputed value without a mature resolution | savings |
| Actual recovered funds | cash settled back after a realized loss/dispute | prevented loss; evidence-ready amount |
| Protection payout | contractual reimbursement/risk transfer | prevention or recovery by the model |
| Evidence-ready value | case value with a complete packet manifest | submitted or won dispute value |
| Labor savings | measured time/cost difference for equivalent work | merchandise loss avoided |
| Legitimate friction cost | incremental conversion/margin, delay, contacts, dissatisfaction, and appeal burden among good actors | acceptable collateral by default |

Each dollar occupies one mutually exclusive economic state for a given reporting window. A case cannot simultaneously contribute its full value to “stopped,” “recovered,” and “protected.”

## Evidence and outcome hierarchy

The prototype uses E0–E5 provenance tiers. Tiers describe support quality, not intent.

| Tier | Meaning | Example |
|---|---|---|
| E0 | unverified assertion or self-report | shopper statement, merchant allegation, model inference |
| E1 | captured metadata with known provenance | timestamped upload metadata, operator note with source |
| E2 | system-observed first-party event | commerce order event, controlled application event |
| E3 | independent carrier/payment/partner corroboration | RMA fact plus independent carrier event |
| E4 | controlled protocol evidence | calibrated weight + required image sequence + custody metadata |
| E5 | adjudicated mature outcome | completed appeal/human decision, processor settlement, independently audited outcome |

Missing or unusable evidence has no tier and is recorded as a quality gap. Empty/quantity/wrong-item physical outcomes can reach E4 with a complete managed protocol. “Imitation” or “counterfeit” generally requires qualified authentication beyond a vision model. Fraudulent intent is a separate label and may remain unknown even when a return is objectively empty or mismatched.

## Core causal estimand

For an eligible unit `i`:

- `Z_i = 1` when assigned to treatment and `0` for control;
- `L_i` is mature realized merchant loss in the pre-defined window;
- `F_i` is legitimate shopper friction cost in the same window;
- `C_i` is intervention/operations cost.

The intention-to-treat estimate of avoided loss is:

```text
ATE_loss = mean(L | Z=0) - mean(L | Z=1)
```

Per 1,000 eligible units:

```text
estimated_loss_avoided_1000 = 1,000 × ATE_loss
net_value_1000 = estimated_loss_avoided_1000
                 - 1,000 × [mean(F | Z=1) - mean(F | Z=0)]
                 - 1,000 × [mean(C | Z=1) - mean(C | Z=0)]
```

Report confidence intervals and the pre-registered observation window. Use assignment, not challenge completion, as the primary estimator so abandonment does not masquerade as fraud. Analyze treatment-on-treated only as a secondary instrumental-variable estimate when assumptions are reviewed.

### Why “did not verify” is not a fraud label

Non-completion combines at least:

- deliberate fraud deterrence;
- privacy preference;
- accessibility barrier;
- vendor outage or latency;
- lost/expired document;
- concern about legitimacy of the request;
- simple abandonment or changed purchase intent.

Therefore the dashboard records `COMPLETED`, `DECLINED`, `ABANDONED`, `TECHNICAL_FAILURE`, `INACCESSIBLE`, and `ALTERNATE_PATH` separately. Only mature downstream outcomes support calibration.

## Worked checkout experiment (illustrative, not a Redo forecast)

Suppose 1,000 eligible high-risk checkout sessions are randomized 1:1:

| Result after a fixed maturity window | Control (500) | Treatment (500) |
|---|---:|---:|
| realized eligible loss | `$4,800` | `$3,000` |
| known-good shoppers in evaluation subset | `450` | `450` |
| completed purchase among known-good | `414` (92%) | `396` (88%) |

Then:

```text
control loss/session   = $4,800 / 500 = $9.60
treatment loss/session = $3,000 / 500 = $6.00
estimated avoided      = ($9.60 - $6.00) × 1,000 = $3,600 per 1,000
```

The treatment also produced a 4 percentage-point known-good conversion reduction. Scaling the 18-order arm difference to 1,000 eligible sessions gives 36 incremental lost orders. At `$45` contribution margin, illustrative friction cost is `$1,620`. If incremental challenge/operations cost is `$400` per 1,000:

```text
illustrative net = $3,600 - $1,620 - $400 = $1,580 per 1,000 eligible sessions
```

This toy arithmetic does not establish statistical significance, transport to another merchant, or reveal which abandoning shopper was fraudulent.

## Worked repeat-linkage funnel (correcting the common shortcut)

Assume only for illustration:

- 1,000 customers;
- 20% make a return → 200 returns;
- 10% of returns eventually meet the chosen mature fraud/abuse outcome → 20 outcomes;
- 80% of those outcomes link to a previously observed entity graph → 16 repeat-linked outcomes.

The number `16` is a retrospective ceiling under those assumptions—not 16 automatically flaggable customers and not 16 prevented events. Prospective potential still depends on point-in-time coverage, sensitivity, and intervention efficacy. For example:

```text
repeat-linked outcomes               16
× usable point-in-time link coverage .75
× model sensitivity                  .70
× intervention efficacy              .80
= 6.72 expected avoided events before uncertainty adjustment
```

Every rate must come from Redo cohort data and be validated prospectively. Shared devices, addresses, networks, and payment instruments link entities; they do not prove the same physical person.

## Estimating capacity by lifecycle checkpoint

For stage `s`, before controlled results exist, a **planning capacity** (not a claim) can be modeled as:

```text
capacity_s = exposure_reaching_s
             × mature_loss_rate_s
             × point_in_time_observability_s
             × sensitivity_at_threshold_s
             × intervention_completion_s
             × efficacy_given_intervention_s
```

Required safeguards:

1. `exposure_reaching_s` excludes cases already resolved upstream.
2. `mature_loss_rate_s` is merchant/cohort-specific; no retail-industry prior is substituted.
3. `observability` measures whether required evidence existed then, not eventually.
4. Chosen threshold includes false-positive cost and review capacity.
5. Efficacy comes from randomization or a credible quasi-experiment.
6. Stage totals use first-stopped waterfall attribution and cannot be simply added.

### Waterfall attribution

For each mature case, retain every stage that signaled but assign economic effect to one state:

```text
first effective intervention
  -> CHECKOUT, ORDER_RELEASE, RETURN_AUTHORIZATION,
     REVERSE_LOGISTICS, INSPECTION, SETTLEMENT, or NONE
```

Other stages receive diagnostic credit (signal coverage, lead time, evidence improvement), not another copy of the dollars.

## `$80M` managed warehouse versus `$200M` broader surface

These are user-supplied scenario inputs, not verified Redo facts. First obtain a data contract for both figures:

- measure name and accounting owner;
- grain (order, merchant, return, refund, shipment);
- gross/net definition;
- calendar/fiscal period and currency;
- whether `$80M` is a true subset of `$200M`;
- whether either is merchant GMV, eligible returned value, or Redo revenue.

Only if finance confirms identical definitions and true subset membership would `$80M / $200M = 40%` describe physical-protocol surface coverage. It still would not mean 40% of fraud is inspectable or preventable.

Maintain two result families:

### Managed warehouse cohort `W`

- strongest E4 physical labels for received packages;
- direct measurement of empty, quantity, serial/wrong-item, packaging, and condition discrepancies;
- site/operator/device/protocol quality dimensions;
- selection conditioned on merchant/category/routing into managed facilities.

### Broader cohort `B`

- checkout, identity, payment, order, return-request, and carrier signals;
- merchant-uploaded evidence with variable protocols;
- weaker or delayed physical outcomes;
- separate calibration, lift, and friction reporting.

Training on `W` and scoring `B` requires a transport analysis: merchant and product mix, return routing, value, region, label delay, evidence availability, and policy. Hold out entire merchants and time periods. Never report warehouse accuracy as broad-surface accuracy.

## Warehouse protocol measurement

### Quality metrics

- required-view completion;
- scale calibration pass and reading stability;
- barcode/OCR agreement;
- seal/exterior/opening sequence integrity;
- reshoot and quarantine rate;
- duplicate blind operator agreement;
- supervisor overturn rate;
- time from receipt to mature label.

### Avoiding biased labels

- Show operators expected RMA facts, but not a “fraudster” score.
- Randomly blind a sample to model recommendations.
- Duplicate-inspect a stratified sample.
- Preserve `INCONCLUSIVE` rather than force a class.
- Separate objective mismatch (`quantity_expected=2`, `quantity_observed=1`) from intent (`fraud=unknown`).

## OpenAI evaluation

The structured assessment is evaluated as a component, not as the final decision.

### Offline regression set

- exact empty, nonempty, quantity, label/serial, and evidence-quality fixtures;
- ambiguous packaging and occlusion;
- adversarial text in images and shopper notes;
- conflicting timestamp/weight artifacts;
- merchant/product groups held out from prompt iteration;
- historical snapshots reconstructed using `availableAt` only.

### Metrics

- schema-valid response rate;
- evidence-reference validity;
- unsupported-claim rate;
- abstention appropriateness;
- per-class precision/recall;
- calibration/reliability curve;
- latency, token/cost, API failure/fallback;
- recommendation disagreement with deterministic rules, policy, and humans.

### Release gate

Any output without valid evidence references, any schema/API error, or any attempted instruction from evidence results in safe `HUMAN_REVIEW`. The model never executes payments, changes return status, submits a dispute, or produces final denial.

## Identity and incentive experiment

The proposed discount test is useful only as a randomized friction/value experiment.

Suggested arms among shoppers already eligible for a step-up:

- A: current/manual review flow;
- B: verification with no incentive;
- C: verification with a small disclosed incentive;
- D: alternate low-data/payment step-up where feasible.

Primary outcomes:

- mature realized loss per assigned session;
- known-good conversion and contribution margin;
- challenge outcome categories;
- completion time, technical/accessibility failure, support contacts;
- repeat purchase and appeal/complaint outcomes.

The incentive threshold may reveal willingness to complete a workflow, not willingness to “prove innocence.” Fraudulent and legitimate shoppers can both accept or decline.

## Shadow-to-enforcement sequence

1. **Observe:** compute features and data-quality rates; no score.
2. **Shadow:** score without changing shopper or operator experience.
3. **Assist:** show recommendation to trained reviewers; record disagreement.
4. **Randomized challenge:** apply low-risk, reversible interventions to eligible units.
5. **Limited automation:** pass/approve/request-evidence only within guarded policy; human adverse action.
6. **Expansion:** only after cohort-specific causal value, calibration, friction, appeal, and operational gates hold.

## Dashboard minimum disclosure

Every metric tile exposes:

- exact numerator/denominator;
- cohort and exclusions;
- time zone, start/end, maturity lag;
- currency and value field;
- point estimate and interval;
- evidence tier distribution;
- model/policy/protocol versions;
- experimental assignment status;
- whether the figure is observed, derived, causal estimate, or planning scenario.
