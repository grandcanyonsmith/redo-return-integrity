# Redo portal and returns-workflow research

Research snapshot: **August 24, 2026**  
Scope: publicly visible Redo shopper, merchant, warehouse, and API surfaces  
Source policy: Redo-owned product pages, Redo Help Center articles and embedded Redo walkthroughs, and Redo developer documentation only

## Executive answer

Redo exposes at least three distinct return-management experiences publicly:

1. A **merchant-branded Customer Portal / RMA Portal** in which a shopper locates an order, selects items, supplies per-item details, chooses a resolution and return method, reviews the amount, submits the return, and receives a QR code or label.
2. A **Redo Merchant Dashboard** with a Returns list, status filters, search, return details, approve/reject/process actions, automations, customer-portal configuration, and a visual return-flow builder.
3. A **Redo Admin / ReturnBear Hub workflow** for physical receiving: scan or search a return, compare the parcel against its RMA, mark declared items present or missing, inspect packaging and item condition, capture photos and notes, record undeclared items, print license plates, and route inventory to grading, warehouse, or quarantine.

The proposed label-photo and package-photo experience should therefore look and behave like an extension of Redo's existing **Scan Return → Process Return (Grading) → Capture evidence → Sort** workflow. It should not be presented as a replacement merchant portal or as a UI pattern Redo does not already use. The new value is automated label-image extraction, multimodal comparison against order/catalog data, structured exception classification, bounded refund guidance, and communication drafting.

Important limit: no authenticated Redo account was used. Private screens, current production feature flags, internal fraud thresholds, and merchant-specific customizations are not observable. The findings below are based on official public help-center screenshots/transcripts and public API documentation. Where the sources conflict, the conflict is preserved.

### Direct visual references

These are public media assets embedded by the official Redo sources cited in the report. Their canonical article/video pages remain the durable citations; the media URLs are included to make design review faster.

- [Merchant Returns list — official walkthrough opening frame](https://cdn.loom.com/sessions/thumbnails/83e612c0cd4d46588661c8dd53dcf72f-00001.jpg)
- [Merchant Return Flow builder — official walkthrough opening frame](https://cdn.loom.com/sessions/thumbnails/5e8b8885531f413891774d7fb6297713-00001.jpg)
- [Merchant Settings › Return Portal and shopper entry preview](https://cdn.loom.com/sessions/thumbnails/7847204d2d77404ba7c97aa3073de1af-00001.jpg)
- [Shopper Select items to return screen](https://downloads.intercomcdn.com/i/o/uazsjpom/2227702785/ed33e25c2e545fc3263f7f2ac93d/image.png)
- [Shopper return-method screen](https://downloads.intercomcdn.com/i/o/uazsjpom/2227821094/1a23f74e414c845e7475f1384f69/image.png)
- [Warehouse Scan Return screen](https://downloads.intercomcdn.com/i/o/uazsjpom/2183602749/a146510697d4d5f6e1aec238cee3/image.png)
- [Warehouse Process Return (Grading) screen](https://downloads.intercomcdn.com/i/o/uazsjpom/2183613525/e64013aa9eaa6d69e9df107f7323/image.png)
- [Warehouse Capture evidence of item condition screen](https://downloads.intercomcdn.com/i/o/uazsjpom/2183699173/482c3fe99ba9b823f57e917812cd/image.png)

## Evidence labels used in this report

- **Observed**: explicitly shown or stated in a current official Redo source.
- **Inferred design direction**: a recommendation based on the observed workflow; not a claim about Redo's private product.
- **Not publicly observable**: cannot be verified without an authenticated environment or non-public documentation.

## 1. Shopper-facing Customer Portal / RMA Portal

### Entry and identity lookup

**Observed.** Merchants place a merchant-specific portal link in the return-policy page, footer, or header. The merchant can also launch the same flow through a **Create Return** button in the Merchant Dashboard. Redo calls the current experience the **Customer Portal** and the **Return Merchandise Authorization (RMA) Portal**. [Customer Portal submission guide](https://help.getredo.com/en/articles/13638784-how-to-submit-return-requests-using-the-customer-portal) [Customer Portal settings overview](https://help.getredo.com/en/articles/8371151-customer-portal-tab-overview)

The official Customer Portal walkthrough shows an order-lookup card, not a conventional password-based shopper account:

- Merchant logo above the form.
- Heading: **Returns & Exchanges**.
- First field: **Email or Zip/Postal**.
- Second field: **Order Number**, with an information icon.
- Links: **Can't find order number?**, **Returning a gift?**, **Return Policy**, and **Back to store**.
- Primary action: **Start Exchange Or Return**.
- Merchant support alert text below the action.

The same screen is shown inside the merchant's **Settings › Return Portal** preview. The merchant can customize the logo, background, primary color, accent color, accent-background color, back-to-store text color, policy link, and alert text. [Official Customer Portal walkthrough](https://www.loom.com/share/7847204d2d77404ba7c97aa3073de1af)

**Implementation implication.** Shopper identity in this surface should be described as an **order lookup** rather than a Redo consumer account unless authenticated product evidence proves otherwise.

### Current shopper sequence

The April 2026 RMA guide contains screenshots for the following sequence. [Customer Portal submission guide](https://help.getredo.com/en/articles/13638784-how-to-submit-return-requests-using-the-customer-portal)

| Step | Public screen terminology | Data shown or collected | Visible decision/action |
|---|---|---|---|
| 0 | **Order: #…** / order preview | Order date and status, shipment, product images, variants, quantities, prices, customer/contact/address/payment information, subtotal/tax/shipping/total | **Start a return** |
| 1 | **Select items to return** | Every order item with image, product, variant, and price | Checkbox per item; **Continue** |
| 2 | **Return details** | Selected product image, name, variant, and price | **Add details** per item |
| 2a | **Why are you returning this item?** | Merchant-configured return-reason input; the example uses a 500-character text field | Enter reason; **Continue** |
| 2b | **How would you like to return this item?** | Merchant-configured payout/resolution choices | Example: **Continue with refund**; other official docs describe exchange and store credit |
| 2c | **Return details** complete | Each item receives a **Ready for return** chip | **Edit** or **Continue** |
| 3 | **Confirm address** | Original and suggested return-from addresses | Select/edit address; **Continue** |
| 4 | **How do you want to return your items?** | Nearby locations and distances; method-specific cost/convenience notes | Choose easy drop-off, box-free location, or box-and-ship; **Continue** |
| 5 | **Review your return** | Shipping information, shipment method, item list, return value, taxes, and refund amount | Go back to edit or **Submit return** |
| 6 | **Your return has been submitted** | What-happens-next instructions, QR-code access, available locations, summary, items, and shipping information | Open/download QR code or locations |

The shopper UI shown in those screenshots is intentionally quiet and transaction-focused: white background, black text and primary buttons, thin gray borders/dividers, rounded cards, product thumbnails, compact green status/cost chips, and one dominant action per screen. It is responsive-looking and avoids the Merchant Dashboard's navigation shell.

### Policy checklist and manual-review transition

**Observed.** The portal can show a merchant-configured Return Policy Checklist. If every criterion is checked, the request can be approved automatically. If a criterion is left unchecked, the request becomes **Pending** and needs merchant approval. Return reasons can also require images or text and route to manual review. [Customer Portal submission guide](https://help.getredo.com/en/articles/13638784-how-to-submit-return-requests-using-the-customer-portal) [Return Flow overview](https://help.getredo.com/en/articles/8371009-return-flow-tab-overview)

**Observed.** Shopper-facing return methods can include:

- **Easy drop-off for fastest refund**, described as printer-free and box-free at a nearby Redo Partner.
- **Box-free return location**, including named partner-location types in the example.
- **Box and ship it back to us**, using a printable carrier label.

The public guide says a return that passes verification at a return point can receive an instant refund; a failed verification produces a delay notice. [Customer Portal submission guide](https://help.getredo.com/en/articles/13638784-how-to-submit-return-requests-using-the-customer-portal)

### What is not shown publicly for shoppers

- No official public screenshot demonstrates a persistent, account-style list of all past returns.
- No public screenshot demonstrates a shopper dispute/appeal evidence inbox after warehouse inspection.
- No public screenshot demonstrates a merchant/warehouse evidence photo embedded in a denial, refund hold, or partial-refund email.
- No public source reviewed shows a shopper uploading government ID in the return flow.

Redo's marketing page says shoppers can initiate and track returns through the branded portal, while Redo's help article directs shoppers to the merchant for policy, technical, and status help. The exact authenticated tracking experience remains unclear from public evidence. [Returns & Claims product page](https://redo.com/products/returns) [Shopper support guidance](https://help.getredo.com/en/articles/13622037-how-to-get-help-with-your-redo-return)

## 2. Merchant Dashboard

### Publicly visible shell and navigation

**Observed from the official walkthrough.** The Merchant Dashboard uses a black left rail and a white content canvas. The selected navigation item is a rounded violet/purple treatment. The walkthrough shows these top-level or nearby items:

- Summary
- Returns
- Orders
- Settings
- Invoices
- Return Portal
- Help
- Logout

When **Settings** is expanded, official walkthroughs show Automations, Billing, Communication, Coverage, Exchanges, Locations/Shipping, Return Flow, and Return Portal. The current help center also describes Users and Notifications settings. [Customer Portal settings overview](https://help.getredo.com/en/articles/8371151-customer-portal-tab-overview) [Self-serve onboarding](https://help.getredo.com/en/articles/8546711-redo-self-serve-onboarding) [Users overview](https://help.getredo.com/en/articles/9171499-users-tab-overview)

**Freshness caveat.** The Returns walkthrough remains published and recently updated in Redo's Help Center, but the demo rows visible in its opening frame are dated 2023 and the browser URL reads `app-new.getredo.com`. Treat its layout and terminology as official representative evidence, not proof that every production tenant has the identical August 2026 shell. [Official Returns walkthrough](https://www.loom.com/share/83e612c0cd4d46588661c8dd53dcf72f)

### Returns list

The public Returns walkthrough shows:

- Page title **Returns**.
- **Export CSV** button.
- Search box in the upper right.
- Status filter tabs across the table.
- Table columns for order, customer, shipping, created date, type, and status.
- Search by order number, customer name, or email. The help center specifically says order-number search may require the `#` prefix.
- Return types displayed as small rounded pills, such as **Store Credit**.

[Returns Tab overview](https://help.getredo.com/en/articles/8370571-returns-tab-overview)

### Return-detail actions

**Observed.** Depending on status and automation settings, a merchant can:

- Download or resend the return label.
- Cancel before the label is used, allowing the shopper to restart and choose a different return type.
- Approve a Needs Review return.
- Reject through **More Actions**.
- Review a shopper's reason, uploaded images, and fraud-risk scores from item details.
- Approve while requiring the item to come back, which releases a return label.
- Approve without requiring a return, which effectively processes a returnless resolution.
- Manually **Process** a return.
- Adjust refund or store-credit amounts.
- Add internal notes.
- Notify the customer.
- Reset a return so the shopper can restart below a selected rule.
- Close a case that will be handled outside Redo.

[Processing Returns in Redo](https://help.getredo.com/en/articles/10771701-processing-returns-in-redo) [Returns Tab overview](https://help.getredo.com/en/articles/8370571-returns-tab-overview)

**Observed.** Return-label controls live on the return detail and support edit/add operations. Public documentation lists destination/return address, package weight, carrier/service, label format including QR code, pricing, multiple labels, and a label timeline. [Managing Return Labels](https://help.getredo.com/en/articles/11542870-managing-return-labels)

**Observed.** A return shipment carrier claim is available from a three-dot menu. A damaged-package claim requires an image, and outstanding carrier claims are tracked under **Order Management › Claims › Carrier Claims**. [Filing a Shipping Claim with Redo](https://help.getredo.com/en/articles/11489054-filing-a-shipping-claim-with-redo)

### Automation controls

Merchants can configure the processing event separately for exchanges, refunds, and store credit. Publicly documented triggers are:

- None / manual Process
- Return Created
- Shipment in Transit / label scanned
- Shipment Delivered
- A day delay after a selected event

The settings also include restocking behavior, label expiration, return reminder/expiration emails, and return-label cost deductions. [Automations overview](https://help.getredo.com/en/articles/8370734-automations-tab-overview) [Self-serve onboarding](https://help.getredo.com/en/articles/8546711-redo-self-serve-onboarding)

### Visual return-flow builder

**Observed.** The Merchant Dashboard includes a node-based Return Flow editor. The official walkthrough shows a gray canvas with white rounded nodes, connecting lines, True/False branches, and a property panel on the right. Example node types and branches include:

- Return request
- Condition, such as within 30 days or a final-sale product tag
- Reject with merchant-authored shopper message
- Return reason
- Required input, such as an image for damaged/wrong item
- Mark for manual review
- Resolution paths for refund, exchange, and store credit

[Return Flow overview](https://help.getredo.com/en/articles/8371009-return-flow-tab-overview) [Official Return Flow walkthrough](https://www.loom.com/share/5e8b8885531f413891774d7fb6297713)

This is the most native location for a merchant to configure when AI inspection results should produce an automatic pass, a temporary hold, a request for evidence, or a human-review task.

## 3. Warehouse / ground-truth operator experience

This surface is the closest existing Redo product analogue to the requested application.

### Existing process map

**Observed.** Redo's public 2026 operations documentation describes two service paths:

- Consolidation-only: **Verify → Warehouse → Fulfillment**.
- Grading: **Verify → Grade → Warehouse → Fulfillment**.

Exceptions and unknown items use dedicated manual flows. [Processing returns at a Redo Hub](https://help.getredo.com/en/articles/13641840-overview-processing-returns-at-a-redo-hub)

### Scan Return

The official **Scan Return** screenshot uses a single large card:

- Orange scanner icon in a pale orange rounded square.
- Prompt: **Scan label to begin**.
- Explanation: scan a return label or inventory license plate.
- Input label: **Return Label or License Plate**.
- Placeholder: **Scan return label, RMA, or license plate**.
- Primary action: **Process return**.

If scanning fails, an operator can manually search with tracking number, RMA, or license plate. The earlier Sort station documentation also lists customer name/email and postal code as fallback identifiers. [Verify overview](https://help.getredo.com/en/articles/13640515-verify-overview) [Sort](https://help.getredo.com/en/articles/13640810-sort)

**Gap relative to the proposed feature.** The public workflow documents barcode/QR scanning and manual identifier entry. It does not state that Redo photographs a shipping label and performs OCR or multimodal extraction over the whole label.

### Process Return (Grading)

The official screenshots display one card per expected product with:

- Product reference image.
- Product name and variant.
- SKU.
- Progress count, such as `0/3`.
- **Missing** and **Process** decisions.

When Process is selected, the operator is guided through bounded binary/enum questions:

1. Retail packaging: **Opened** or **Factory Sealed**.
2. Item condition: **Damaged or Dirty** or **New Condition**.
3. If damaged/dirty: **Damaged** or **Only Dirty**.
4. If dirty: cleaning instructions, then **Still Dirty** or **Now Clean**.
5. If damaged: a **Capture evidence of the item's condition** screen with the catalog image and SKU, live camera/image area, **Capture** button, required-image marker, and Notes field.

The cards later display the recorded disposition and a sort directive such as **Sort to WAREHOUSE**. [Verify overview](https://help.getredo.com/en/articles/13640515-verify-overview) [Grade](https://help.getredo.com/en/articles/13640798-grade)

The public Grade guide states that the operator must take photos of damage and select all applicable damage types, with examples such as ripped/torn and signs of wear. Undeclared items require photos and a plain-language description. [Grade](https://help.getredo.com/en/articles/13640798-grade)

### Missing, wrong, and undeclared items

**Observed.** Redo already uses operational vocabulary that maps cleanly to empty-box, wrong-item, and quantity-mismatch cases:

- **Missing**: an expected RMA item was not physically received.
- **Undeclared item**: an item was received in addition to or instead of a declared item.
- **Unknown Item Flow**: manual merchant and product-variant lookup when an item cannot be received normally.
- **Sort for Quarantine**: verification failed or required information is missing.
- **No More Declared Items** / **Item Not Received**: close out unmatched expected items.

[Verify overview](https://help.getredo.com/en/articles/13640515-verify-overview) [Verify for Grading](https://help.getredo.com/en/articles/13639019-verify-for-grading) [Unknown Item Flow](https://help.getredo.com/en/articles/13641870-unknown-item-flow)

**Inferred mapping for the return-integrity prototype.** Preserve Redo's native operator terms and layer fraud-oriented structured labels behind them:

| Native operator observation | Structured integrity classification |
|---|---|
| Every expected item marked Missing and no undeclared item | `EMPTY_BOX` candidate, subject to package-evidence sufficiency |
| Some expected units Missing | `QUANTITY_MISMATCH` |
| Declared item Missing plus an undeclared item present | `WRONG_PRODUCT` candidate |
| Expected item processed but visual/serial/packaging evidence conflicts | `POSSIBLE_IMITATION` or `INCONCLUSIVE`; human authentication required |
| Expected item Processed and condition is Damaged/Dirty | `DAMAGED_PRODUCT` |
| Expected item, quantity, SKU/serial, and condition all match | `MATCH` |

Do not replace **Missing**, **Process**, **Undeclared**, or **Quarantine** with fraud accusations in the operator UI. The integrity label is a machine recommendation; the physical observation remains the ground-truth record.

### Existing evidence sharing

The Redo Hub FAQ says photos and written descriptions captured during verification/grading are shared with the merchant. It also asks hub staff to provide label and package/item photos when a label cannot be scanned. [Hub Partners FAQ](https://help.getredo.com/en/articles/13653125-hub-partners-frequently-asked-questions)

No reviewed public source shows that those images are automatically sent to the shopper, embedded in a shopper email, or assembled into chargeback evidence. That portion of the proposed product is an extension.

## 4. Status vocabulary and source conflicts

The public sources do not use one perfectly consistent status vocabulary. The implementation should preserve the raw provider status and map it to a normalized internal state rather than hard-code visible tab labels as canonical.

### Canonical public API enum

Redo's v2.2 Return Status endpoint documents:

| API status | Official description |
|---|---|
| `open` | Approved and awaiting shipment |
| `in_transit` | Return shipment is in transit |
| `delivered` | Delivered and awaiting processing |
| `needs_review` | Requires review before further action |
| `in_review` | Currently being reviewed |
| `complete` | Completed successfully |
| `rejected` | Rejected |
| `flagged` | Processing problem requires merchant action |
| `pre_shipment` | Requires pre-shipment merchant authorization |
| `deleted` | Deleted / Reset |

[Return Status API](https://developers.redo.com/api-reference/returns/return-status)

### Additional public UI terms

Official merchant help content and videos also show or describe **All**, **Cancelled**, **Expired**, **Closed**, **Pre-transit**, and **Pending**. One help article describes Open as label-created/not-yet-shipped, which agrees with the API's broad meaning. Another FAQ describes Open as awaiting merchant approval and separately uses Pre-transit for label-created/not-dropped-off. These differences may reflect legacy UI, product changes, or display-derived states; the public sources do not resolve them. [Returns Tab overview](https://help.getredo.com/en/articles/8370571-returns-tab-overview) [Return Processing FAQ](https://help.getredo.com/en/articles/8400651-return-processing)

Recommended internal rule:

- Store the original Redo status unchanged.
- Add a normalized lifecycle state used by the integrity engine.
- Treat shopper **Pending** as an interface label, not proof that its API value is `needs_review` unless the live integration confirms it.
- Treat Cancelled, Expired, and Closed as potentially UI-derived or legacy until live API payloads establish their representation.

## 5. Public API data that fits the UI

Redo's public Return resource already contains much of the context needed for the proposed inspection view:

- Customer name, email, phone, and source address.
- Order identity, totals, discounts, shipping, taxes, and line items.
- Product and variant names, external IDs, SKU, quantity, price, fulfillment location, and weight.
- Returned-item quantity, reason/reason codes, customer comment, assessments, SKU/UPC, item status, and refund amount/type.
- Return source/destination, compensation methods, notes with message or image, shipments, tracking, drop-offs, tags, and aggregate refund/exchange/store-credit/charge totals.

[Return API](https://developers.redo.com/api-reference/returns/return)

The beta Process Return endpoint accepts per-product process inputs, a merchant adjustment, a restock flag, a reject flag, and customer notes. Public documentation does not define enough semantics to assume the adjustment is always a partial refund, so the prototype should keep its own deterministic refund recommendation separate from any live Redo mutation until validated. [Process Return API](https://developers.redo.com/api-reference/returns/process-return)

Redo also exposes image/message return comments and describes 3PL/WMS integrations that update status, add notes, and process returns as they move through receiving, inspection, and restocking. [Create Return Comment API](https://developers.redo.com/api-reference/returns/create-return-comment) [Returns integration guide](https://developers.redo.com/docs/guides/integrations/integrating-with-returns-apis)

## 6. Visual language to carry into the prototype

### Shopper surface: merchant-branded and minimal

**Observed:**

- White page and card surfaces.
- Near-black primary buttons and headings in the example merchant.
- Thin gray borders and dividers.
- Centered page title/instruction at most steps.
- Product thumbnail, name, variant, and price repeated consistently.
- Compact green success/benefit chips.
- Previous-page control on the left and primary Continue action on the right.
- A summary card becomes prominent at final review.

**Inferred design direction:** a shopper contest/evidence step should be inserted into this same simple, one-decision-per-screen sequence. It should not expose raw risk scores or internal classifications.

### Merchant surface: dense operational workspace

**Observed:**

- Dark left navigation rail.
- White content canvas.
- Purple selected-navigation treatment in the published dashboard walkthrough.
- Tables, horizontal status tabs, search, CSV export, and small status/type pills.
- Black high-emphasis buttons.
- Rounded cards and a right-side inspector in the Return Flow builder.

**Inferred design direction:** show the AI inspection as a return-detail panel or new operational tab, with evidence comparison and bounded action controls. Avoid a marketing-dashboard aesthetic.

### Warehouse surface: touch-first single task

**Observed:**

- White/light-gray surface and large vertically stacked cards.
- Orange line icons in pale-orange rounded squares.
- Large black touch targets for Missing/Process and grading choices.
- Product reference image, variant, and SKU always adjacent to the decision.
- Camera capture and notes are embedded in the condition flow.
- Simple progress counters and explicit next physical destination.

**Inferred design direction:** the new intake page should start with the existing **Scan Return** mental model, then compare **Purchased SKU** and **Received evidence** side by side, keeping a large operator decision and physical routing instruction visible after model output.

## 7. Product fit: existing capability versus proposed extension

| Capability | Publicly evidenced in Redo today | Proposed extension |
|---|---|---|
| Merchant-branded shopper portal | Yes | Add shopper evidence/contest step when policy permits |
| Return-reason image/text requirement | Yes | Model-guided evidence quality checks |
| Merchant manual approve/reject/process | Yes | Structured recommendation with deterministic policy guardrails |
| Return amount adjustment | Yes, manual/public API adjustment field | Explainable full/partial/temporary-hold recommendation |
| Scan RMA/label/license plate | Yes, barcode/QR/manual identifier | Whole-label photo extraction and lookup |
| Expected product reference image/SKU | Yes | Multimodal comparison against received-package photo |
| Missing/Process and undeclared-item handling | Yes | Empty-box, quantity-mismatch, wrong-product classification |
| Damage photo and notes | Yes | Structured visual analysis and missing-evidence prompts |
| Warehouse/quarantine routing | Yes | Confidence-aware next-action recommendation |
| Evidence shared with merchant | Yes | Evidence packet with catalog and provenance images |
| Evidence sent to shopper automatically | Not publicly observed | Draft/queue shopper email or SMS after human approval |
| Photo-driven partial-refund recommendation | Not publicly observed | Bounded deterministic amount calculation plus model rationale |
| Counterfeit/imitation detection | Not publicly observed | Possible-imitation flag only; human authentication required |
| OpenAI or MCP integration | Not publicly observed | Implement model tools without claiming Redo already uses them |

## 8. Recommended information architecture for the build

This section is design inference, not a description of Redo's private portal.

1. Add **Return intake** under the existing Merchant/Operator experience, but title the operator's first card **Scan Return** to match Redo's warehouse vocabulary.
2. Keep the four-step flow visible:
   - Scan or photograph label
   - Confirm matched RMA/order
   - Capture and analyze contents
   - Review disposition, amount, and communication
3. In the matched-return view, show the same stable anchors as Redo:
   - Catalog image
   - Product name and variant
   - SKU/UPC/serial if available
   - Expected quantity
   - RMA, order, tracking, and current status
4. Preserve physical observations separately from the model result:
   - Operator facts: Missing/Process, observed quantity, opened/factory sealed, damaged/dirty/new, undeclared item, weight, images.
   - Model recommendation: classification, confidence, evidence sufficiency, next action, refund recommendation, communication recommendation.
5. Use **Temporary hold** or **Needs review** for adverse uncertain outcomes. Final rejection should remain a merchant/human action.
6. Name test communication actions **Preview** and **Queue test email/SMS** until a production sender, recipient, policy, and authorization are configured.
7. Render catalog and warehouse images together in the message preview, with evidence IDs/timestamps and clear labels such as **Purchased item reference** and **Warehouse inspection evidence**.

## 9. What cannot be claimed from public evidence

The implementation and presentation should not state that Redo currently has any of the following unless live tenant access or Redo staff confirms it:

- OpenAI-backed label OCR or multimodal return inspection.
- MCP servers/tools in its production stack.
- Automated empty-box, quantity-mismatch, wrong-item, or imitation detection from images.
- An existing partial-refund recommendation engine.
- Automatic warehouse-evidence emails or texts to shoppers.
- Automatic shopper appeal or dispute workflows.
- Automatic pre-dispute/card-network evidence submission from this warehouse flow.
- Any particular fraud-model input, score threshold, accuracy, or prevention rate.
- A single universal shopper design; the portal is merchant-brand customizable.
- A single universal status-tab set; Redo's own current public materials differ.

## 10. Official source index

All sources were reviewed on August 24, 2026.

### Shopper portal

- [How to submit return requests using the Customer Portal](https://help.getredo.com/en/articles/13638784-how-to-submit-return-requests-using-the-customer-portal) — April 2026 step-by-step RMA flow and embedded screenshots.
- [Customer Portal Tab Overview](https://help.getredo.com/en/articles/8371151-customer-portal-tab-overview) — portal preview, branding controls, and entry-form terminology.
- [Official Customer Portal walkthrough](https://www.loom.com/share/7847204d2d77404ba7c97aa3073de1af) — embedded by the preceding Redo help article.
- [How to Get Help with Your Redo Return](https://help.getredo.com/en/articles/13622037-how-to-get-help-with-your-redo-return) — shopper support/status guidance.
- [Returns & Claims](https://redo.com/products/returns) — public product positioning and portal customization claims.

### Merchant dashboard

- [Returns Tab Overview](https://help.getredo.com/en/articles/8370571-returns-tab-overview) — filters, search, label actions, status behavior, CSV export.
- [Official Returns walkthrough](https://www.loom.com/share/83e612c0cd4d46588661c8dd53dcf72f) — dashboard shell and Returns table visual evidence.
- [Processing Returns in Redo](https://help.getredo.com/en/articles/10771701-processing-returns-in-redo) — approval, processing, adjustments, notes, notification, and More Actions.
- [Return Processing](https://help.getredo.com/en/articles/8400651-return-processing) — public FAQ and alternate status terminology.
- [Return Flow Tab Overview](https://help.getredo.com/en/articles/8371009-return-flow-tab-overview) — rule graph, image/text inputs, manual review, and resolution branches.
- [Official Return Flow walkthrough](https://www.loom.com/share/5e8b8885531f413891774d7fb6297713) — visual node-editor evidence.
- [Automations Tab Overview](https://help.getredo.com/en/articles/8370734-automations-tab-overview) — processing triggers, delays, restocking, and label emails.
- [Self Serve Onboarding](https://help.getredo.com/en/articles/8546711-redo-self-serve-onboarding) — dashboard settings map and portal configuration.
- [Managing Return Labels](https://help.getredo.com/en/articles/11542870-managing-return-labels) — edit/add label controls and data.
- [Filing a Shipping Claim with Redo](https://help.getredo.com/en/articles/11489054-filing-a-shipping-claim-with-redo) — claim actions and damaged-image requirement.

### Warehouse and ground truth

- [Verify: Overview](https://help.getredo.com/en/articles/13640515-verify-overview) — Scan Return, RMA lookup, declared item comparison, packaging/condition, license plates, undeclared items.
- [Grade](https://help.getredo.com/en/articles/13640798-grade) — physical inspection, camera evidence, damage types, repacking, and sort routing.
- [Verify for Grading](https://help.getredo.com/en/articles/13639019-verify-for-grading) — per-item verification and quarantine path.
- [Verify for Consolidation Only](https://help.getredo.com/en/articles/13638981-verify-for-consolidation-only) — case-level verification and warehouse path.
- [Sort](https://help.getredo.com/en/articles/13640810-sort) — first checkpoint, scan/manual lookup, license plating, and physical bins.
- [Unknown Item Flow](https://help.getredo.com/en/articles/13641870-unknown-item-flow) — merchant/catalog variant search and unknown inventory creation.
- [Hub Partners FAQ](https://help.getredo.com/en/articles/13653125-hub-partners-frequently-asked-questions) — evidence sharing, label exceptions, and support escalation.
- [Overview: Processing returns at a Redo Hub](https://help.getredo.com/en/articles/13641840-overview-processing-returns-at-a-redo-hub) — end-to-end operations map.

### API and integration

- [Return Status](https://developers.redo.com/api-reference/returns/return-status) — public v2.2 status enum and meanings.
- [Return](https://developers.redo.com/api-reference/returns/return) — order, customer, product, return, assessment, refund, note/image, shipment, and totals schema.
- [Process Return](https://developers.redo.com/api-reference/returns/process-return) — beta per-product process/reject/adjustment contract.
- [Create Return Comment](https://developers.redo.com/api-reference/returns/create-return-comment) — image or message comments.
- [Integrating with Returns APIs](https://developers.redo.com/docs/guides/integrations/integrating-with-returns-apis) — 3PL/WMS lifecycle integration guidance.
