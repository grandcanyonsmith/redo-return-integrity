# Source register

Last verified: August 24, 2026.

This register separates public facts from design hypotheses. A link means the source supports the adjacent statement; it does not imply that Redo has approved this proposal.

## Redo product and integration facts

- Redo describes Returns & Claims as a customizable returns and claims portal with image, history, and policy-aware review, and describes Redo Managed Returns as a warehouse network that handles receiving, verification, and grading: [Redo Returns & Claims](https://redo.com/products/returns).
- Redo's public Verify guide describes matching received items to an RMA, recording missing versus processed items, packaging condition, item condition, and a license plate: [Verify overview](https://help.getredo.com/en/articles/13640515-verify-overview).
- Redo documents return lifecycle statuses including `open`, `in_transit`, `delivered`, `needs_review`, `in_review`, `complete`, `rejected`, `flagged`, and `pre_shipment`: [Return Status API](https://developers.redo.com/api-reference/returns/return-status).
- Redo's integration guide describes return webhooks, return detail retrieval, status updates, label/rate operations, and processing after inspection: [Integrating with Returns APIs](https://developers.redo.com/docs/guides/integrations/integrating-with-returns-apis).
- Redo describes Reclaim as compiling order, tracking, return, policy, and communication evidence for chargebacks, with automated submission in supported workflows: [Redo Chargebacks](https://redo.com/products/chargebacks) and [What is Reclaim?](https://help.getredo.com/en/articles/14061193-what-is-reclaim).
- The public Senior/Staff Software Engineer listing names TypeScript, Node.js, React, AWS, Shopify, and Stripe: [Redo role listing](https://redo.hirehive.com/seniorstaff-software-engineer-draper-E5QiHM).

## Market context

- NRF and Happy Returns reported that surveyed retailers estimated a 16.9% 2024 annual return rate and $890 billion in returns. The samples and methodology are described in the report and should not be assumed to represent any Redo merchant: [NRF 2024 returns report](https://cdn.nrf.com/sites/default/files/2024-12/2024-Consumer-Returns-in%20the-Retail-Industry-Report_12.5.24.pdf).
- NRF and Appriss reported a 13.7% share of 2023 returned merchandise associated with return fraud and abuse. That combined category and the 2023 methodology are not interchangeable with verified criminal fraud, a merchant-specific rate, or the 2024 NRF study: [NRF 2023 returns report](https://cdn.nrf.com/sites/default/files/2024-01/Customer_Returns_Report_2023_Final.pdf).
- NRF's July 2026 Retail Fraud Taxonomy describes an industry effort to standardize fraud schemes, tactics, mitigations, and detection sources: [NRF Retail Fraud Taxonomy](https://nrf.com/research/retail-fraud-taxonomy).

## OpenAI implementation facts

- The implementation uses the Responses API, structured output, image inputs when evidence is visual, and `store: false`: [Responses API reference](https://developers.openai.com/api/reference/resources/responses/methods/create).
- The default proposed model is GPT-5.6 Terra; the model page documents image input and structured outputs: [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra).
- Model selection and prompting follow current model guidance: [Latest-model guide](https://developers.openai.com/api/docs/guides/latest-model).

## AWS implementation facts

- CloudFront Origin Access Control is AWS's recommended mechanism for a private S3 origin: [Restrict access to an Amazon S3 origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).
- API Gateway HTTP APIs support stage- and route-level throttling: [HTTP API throttling](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-throttling.html).
- DynamoDB TTL deletes expired items asynchronously; an expired item may remain visible until background deletion: [DynamoDB TTL](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/TTL.html).
- S3 Lifecycle expiration is asynchronous and is not an exact deletion clock: [Expiring objects](https://docs.aws.amazon.com/AmazonS3/latest/userguide/lifecycle-expire-general-considerations.html).

## Scenario inputs that are not verified public facts

The following are planning assumptions supplied for this interview exercise and must remain labeled as such:

- A broader `$200M` addressable commerce or customer-revenue surface.
- An `$80M` subset expected to pass through managed warehouses by Q1 2028.
- `4,500+` Redo merchants.
- The timing, accounting definition, and denominator behind each figure.

Before an investment case is presented as a forecast, Redo finance and data owners must define whether each number is merchant GMV, merchant revenue, return value, Redo revenue, warehouse-processed GMV, or another measure. This proposal never multiplies a retail-fraud prior by Redo company revenue.
