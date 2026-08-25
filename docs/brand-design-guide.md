# Brand and interface design guide

This is a **candidate extrapolation** from Redo's public web presence observed August 24, 2026. It is not Redo's official brand kit, trademark permission, or internal design-system documentation. Redo should replace tokens/assets with approved sources before production.

## Design intent

The visual system pairs Redo's high-energy orange and editorial scale with a quieter evidence workspace. The interface should feel commercially confident at the top level and forensic/precise inside a case.

Principles:

1. **Outcome first.** Headings say what the user can decide or resolve.
2. **Evidence is inspectable.** Sources, tiers, timestamps, and version labels are visible without looking like raw developer output.
3. **Uncertainty has a visual language.** Concern, inconclusive, unavailable, and simulated are distinct.
4. **Adverse actions are visually deliberate.** Deny is never the primary orange call-to-action and always discloses review/appeal.
5. **Shopper copy is non-accusatory.** Say “we need one more piece of information,” not “you appear fraudulent.”

## Extrapolated foundation tokens

### Brand/neutrals

| Token | Value | Use |
|---|---|---|
| `--orange` | `#fe4608` | signature accent, evidence scan line, emphasized display text |
| `--orange-cta` | `#ff4404` | primary action |
| `--orange-dark` | `#d63a06` | hover, accessible accent text on light surface |
| `--ink` | `#0c0c0c` | hero/nav/footer |
| `--ink-2` | `#141413` | dark sections |
| `--ink-3` | `#201f1e` | dark interactive surface |
| `--paper` | `#f9fafb` | application background |
| `--surface` | `#ffffff` | cards/panels |
| `--surface-2` | `#f3f4f6` | secondary panel/background |
| `--text` | `#0b0e1a` | primary text |
| `--muted` | `#6b6a67` | secondary copy |
| `--line` | `#e4e5e7` | borders/dividers |

### Semantic additions (proposal, not observed brand tokens)

| Semantic | Solid | Soft | Meaning |
|---|---|---|---|
| evidence/pass | `#16855b` | `#eaf8f1` | corroborated/pass/approved |
| information/carrier | `#315bd6` | `#edf2ff` | system/fact/in transit |
| experiment/model | `#7251c9` | `#f2effc` | model/experiment/simulated |
| adverse/error | `#c13232` | `#fff0ee` | denial/error only, never generic “fraudster” |
| caution/accent | `#fe4608` | `#fff1eb` | challenge/attention/Redo accent |

Do not rely on color alone. Pair every state with text and, where useful, an icon.

## Typography

- UI: `Inter`, system sans fallback.
- Editorial/display accent: `Instrument Serif`, Georgia fallback, usually italicized emphasis inside a sans heading.
- Evidence IDs/code: platform monospace.

Suggested scale:

- hero: responsive 58–116px, tight `0.82–0.95` line height;
- page title: responsive 40–72px;
- section title: responsive 38–68px;
- body: 14–16px at comfortable 1.6–1.75 line height;
- dense console labels: never below a tested accessible rendered size; current prototype microcopy should be enlarged if usability testing shows strain.

Avoid all-serif body text. Avoid using italics for status or critical evidence.

## Shape, depth, and spacing

- standard radius: `10px`;
- compact/button radius: `5px`;
- badge radius: `4px`;
- soft card shadow: `0 1px 2px rgba(11,14,26,.04), 0 5px 18px rgba(11,14,26,.05)`;
- hero/modal shadow: `0 24px 70px rgba(11,14,26,.13)`;
- use 1px neutral borders so evidence groups remain legible without excessive elevation;
- suggested spacing base: 4px, with common 8/12/16/24/32/48/64 increments.

## Component behavior

### Primary button

Orange fill, white label, one clear action. Use for “Evaluate evidence,” “Submit appeal,” or “Continue,” not for final denial.

### Decision badge

Badge always spells out state: `OPENAI · LIVE`, `SIMULATED ADAPTER`, `INCONCLUSIVE`, `HUMAN DECISION`, `E4 PROTOCOL`. Tooltips explain provenance; a tier is not intent.

### Evidence card

Minimum content: artifact title, native source, observed/available times, tier, protocol, checksum indicator, privacy/use scope, and referenced findings. Preserve full image aspect ratio and visible loading/error state.

### Decision pipeline

Use a repeated horizontal/vertical sequence:

1. Native facts
2. Deterministic signals
3. OpenAI assessment
4. Merchant policy
5. Accountable action
6. Cure / next state

The pipeline should remain readable at 390px as stacked cards.

### Deny control

Red outline/soft surface, not visually dominant. On activation require reason, evidence selection, policy display, notice deadline, and appeal path. Confirmation states “This is a human merchant decision.”

### Shopper cure

Lead with time and outcome: “Confirm payment — about 1 minute — order stays active.” Show alternatives and technical support before a deadline warning.

## Copy system

Prefer:

- “The carrier timeline conflicts with the staffed receipt.”
- “We could not confirm the package contents from this view.”
- “Add one of these items to continue.”
- “A merchant reviewer will decide by August 27.”
- “Possible item inconsistency—qualified review required.”

Avoid:

- “Fraudster,” “caught,” “guilty,” or “prove your innocence.”
- “The AI decided.”
- “Counterfeit” based on images alone.
- “Chargeback submitted” when only a packet exists.
- “Saved” for a held, unresolved, protected, or modeled amount.

## Motion

- Keep motion functional: evidence scan, state transition, progress, and subtle hover.
- Respect `prefers-reduced-motion`; eliminate looping scan/ambient animations when set.
- Avoid animation on legal/decision copy or evidence comparison.
- Do not use celebratory motion for denial or recovery.

## Responsive rules

- 390px: one column; sticky nav collapses; buttons ≥44px touch target; tables use cards or intentional horizontal scroll with labels.
- 768px: one/two-column hybrid; decision pipeline stacks where necessary.
- desktop: maximum readable content width; case/evidence split view may use 55/45.
- A selected evidence item renders its preview immediately—no hidden second action.

## Accessibility acceptance

- keyboard access and visible focus for all interactive elements;
- semantic headings/landmarks and real buttons/labels;
- alt text describes evidentiary content without asserting intent;
- live status uses restrained `aria-live` and never traps focus;
- text/state contrast checked against WCAG 2.2 AA targets;
- accessible bot/verification alternative;
- error summary plus field-level errors;
- reduced motion, zoom/reflow, and 200% text tests;
- status never conveyed only by orange/red/green.

## Asset and trademark boundary

The prototype uses a text treatment rather than copying a proprietary logo asset and names itself “Redo Return Integrity — candidate proposal.” All product/merchant images are synthetic. Before public commercial use, obtain approved logo, fonts/licensing, trademark language, screenshots, iconography, and brand review.
