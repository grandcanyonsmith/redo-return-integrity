# Documentation map

Start with the [product specification](./product-spec.md), then use the source that matches the review question.

| Document | Purpose |
|---|---|
| [Product specification](./product-spec.md) | users, requirements, packaging, KPIs, market context, dependencies, timeline, pricing, risks |
| [Lifecycle decision matrix](./lifecycle-decision-matrix.md) | all 15 checkpoints, data sources/points, decisions, escalations, cure paths |
| [Measurement methodology](./measurement-methodology.md) | causal prevention, friction, evidence tiers, stage capacity, `$80M`/`$200M`, worked examples |
| [Architecture](./architecture.md) | AWS topology, decision/evidence flows, Reclaim state machine, failure behavior |
| [Data dictionary](./data-dictionary.md) | domain schema, timestamps, DynamoDB keys, enumerations, analytics cautions |
| [HTTP API](./api.md) | routes, session/auth boundary, payloads, errors, idempotency |
| [Security and privacy](./security-privacy.md) | data classes, threat model, identity/OpenAI boundaries, retention, production gates |
| [Implementation plan](./implementation-plan.md) | phases, workstreams, pilot gates, backlog, RACI, time to revenue |
| [Brand/design guide](./brand-design-guide.md) | explicitly extrapolated tokens, components, copy, responsive/accessibility rules |
| [Sources](./sources.md) | public evidence and qualifications versus scenario inputs |
| [AWS deployment](./deployment.md) | secret-safe manual CDK deploy, publish, smoke, rollback, teardown |
| [Loom storyboard](./loom-storyboard.md) | timed ~8-minute narrative and exact demo beats |
| [Demo runbook](./demo-runbook.md) | preflight, three journeys, failures, accessibility, recovery |
| [Notion publishing](./notion-publishing-guide.md) | version-controlled page map and signed-out verification |
| [Four-link checklist](./delivery-checklist.md) | public GitHub, Notion, Loom, live-app acceptance and email template |

## Reading rules

- “Candidate proposal” means proposed by Canyon Smith, not approved by Redo.
- “Live” means the request executed through the live API path; each simulated adapter/model fallback is separately labeled.
- `$80M` and `$200M` are supplied scenarios until Redo finance defines them.
- A score, allegation, nonresponse, or hold is not ground truth or prevented fraud.
- OpenAI never owns final adverse action.
- `EVIDENCE_READY` never means submitted to a card processor.
