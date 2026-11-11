**Sentinel Research — AI model and provider evaluation**

Implementation follow-up: [ADR-034](DECISIONS.md#adr-034--controlled-multi-model-intelligence) now provides configurable Gemini/Groq/OpenRouter routing and explicit collaboration. [The runtime guide](AI-MULTI-MODEL.md) documents the selected models and privacy/cost controls. `yarn ai:evaluate` runs reproducible synthetic offline schema/source checks; it makes no inference calls and establishes no model-quality ranking. The provider/pricing comparison below retains its original evaluation scope.

Verified against official public documentation and live public model catalogs on **9 November 2026**. Prices are USD per million tokens unless stated otherwise.

**Zero-budget recommendation, following the clarified constraint.** For confidential research without an API bill or additional hardware, use Groq’s free **GPT-OSS 120B** for research and **GPT-OSS 20B** for summaries, with Zero Data Retention enabled. This requires much smaller requests than Sentinel’s 30k–60k input allowances: Groq publishes an 8k TPM limit for each model. Budget approximately 3k total input plus up to 4k total output for a research request, or 5k input plus 2k output for a summary, leaving headroom below that limit. Include system prompts, history and schemas in input accounting, and include reasoning in output accounting. Respect the per-minute and daily quotas and make evidence omissions explicit. The existing single orchestrator and human authority remain appropriate.

For a public/synthetic-data MVP, free **Gemini 3.8 Flash** for research and **Gemini 3.5 Flash-Lite** for summaries offer larger model windows, subject to the project’s actual free quotas. For confidential 30k–60k inputs, **local Ollama on suitable hardware already owned** is the zero-API-fee option: evaluate Qwen3.8:27b or the lighter Gemma4:12b. Memory and latency still need checking; local software does not supply free cloud hardware.

A follow-up check found that the current **Nvidia-hosted free Nemotron endpoint explicitly prohibits uploading confidential information or personal data** and logs use for security and product improvement. Therefore it is a public/synthetic-data option, not a verified private-research substitute. [Free endpoint notice](https://openrouter.ai/nvidia/nemotron-3.5-super-vl:free), [current endpoint metadata](https://openrouter.ai/api/v1/models/nvidia/nemotron-3.5-super-vl:free/endpoints). All fallback choices in a zero-budget deployment must also have zero inference cost.

**Paid comparison recommendation.** Use **Claude Sonnet 5.5** for demanding research, evidence review and false-positive review, and **Claude Haiku 5.5** for finding and session summaries as the practical primary pair when funds are available. Evaluate **paid Gemini 3.8 Flash** for routine research to reduce cost further. The recommended paid provider combination, after that evaluation, is **Anthropic directly plus the paid Gemini API directly**. Both fit Sentinel’s existing single orchestrator, role prompts, dedicated task budgets, structured schemas and authoritative human review.

The strongest Google flagship candidate is **Gemini 4 Argon**. The strongest broadly advertised OpenAI flagship available through OpenRouter is **GPT-6 Astra**, but its $10/$50 pricing makes **GPT-6.1 Sol** the better fit for this cost objective. **Groq GPT-OSS 120B** is the best broadly available production research candidate on Groq; **GPT-OSS 20B** is the cheaper summary candidate. **Qwen3.8:27b** is the practical local Ollama research candidate to test first.

These are recommendations from specifications, published positioning, contracts and pricing, **not measured Sentinel accuracy or latency rankings**. Public coding and reasoning benchmarks do not establish evidence-grounding, false-positive precision or safe hypothesis quality on Sentinel’s cases. Cheaper candidates need a task-specific comparison before replacing the primary research model.

**A near-term production constraint matters.** Anthropic lists `claude-sonnet-4-5-20250929` as deprecated, with retirement on **30 November 2026**, and recommends Sonnet 5.5. Sentinel’s `claude-sonnet-4-5` default should therefore be replaced before retirement. Haiku 4.5 remains listed as active. [Official retirement schedule](https://platform.claude.com/docs/en/about-claude/model-deprecations).

**Sentinel’s actual constraints.** The repository’s [task profiles](../src/modules/ai/domain/ai-config.ts) allocate:

| Task group | Input budget | Output budget | Current tier |
| --- | ---: | ---: | --- |
| Recon, attack-surface analysis, hypothesis generation | 40,000 | 3,000 | Sonnet |
| Pattern analysis | 40,000 | 4,000 | Sonnet |
| Evidence review, false-positive review, report generation | 60,000 | 4,000 | Sonnet |
| Finding and session summaries | 30,000 | 2,000 | Haiku |

The [budget module](../src/modules/ai/domain/ai-budgets.ts) sets a 250,000-token daily user cap. The [task service](../src/modules/ai/application/task-service.ts) defaults to a 45-second provider timeout. A 60k input allowance needs room for output and the complete request; a nominal 32k context model cannot serve that task. Context capacity, API token throughput and Sentinel’s own task allowance are separate limits. Actual short requests can fit a free allowance even when a full-budget request cannot.

The existing [AIProvider interface](../src/modules/ai/application/provider.ts) supports a provider adapter without changing orchestration. The current [Anthropic adapter](../src/modules/ai/infrastructure/anthropic-provider.ts) uses a forced schema-bearing tool, followed by application validation. Provider-specific JSON envelopes and inference settings belong in an adapter. Human adoption, evidence-reference checks and capability enforcement remain in the existing application services.

**The incumbent upgrades deserve inclusion in the comparison.** Their lower prices can reduce Sentinel’s cost with relatively little provider migration work:

| Exact Claude API identifier | Standard input / output price | Direct API context / maximum output | Assessment for Sentinel |
| --- | --- | --- | --- |
| `claude-sonnet-4-5` / `claude-sonnet-4-5-20250929` | $3 / $15 | 200k / 64k | Strong incumbent comparison baseline; scheduled for retirement on 30 November |
| `claude-haiku-4-5` / `claude-haiku-4-5-20251001` | $1 / $5 | 200k / 64k | Capable summary baseline; now relatively expensive |
| `claude-sonnet-5-5` | $2 / $10 | 1M / 128k | Recommended primary research replacement; Anthropic’s recommended Sonnet 4.5 successor |
| `claude-haiku-5-5` | $0.10 / $0.50 for prompts ≤100k | 1M / 128k | Recommended primary summary replacement; 90% lower token rates at Sentinel’s summary budget |

Haiku 5.5 prompts over 100k cost $0.50 input and $2.50 output; the higher rates apply to the whole request. Sentinel’s 30k summaries fall in the cheaper band. Sonnet 5.5 is one-third cheaper per input and output token than Sonnet 4.5. Its improved publisher positioning is a reason to evaluate the replacement, rather than proof of Sentinel-specific accuracy.

Anthropic now supports native structured JSON and strict tools. Sentinel’s current forced tool does **not** set `strict: true`, so it should not be described as constrained decoding. Continue Zod and semantic validation with either mechanism. Current documentation also describes refusal, truncation and enum-casing exceptions to structured-output guarantees. Recent Claude API versions remove sampling parameters; compatibility should be checked before a model upgrade.

Sources: [Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing), [current model specifications](https://platform.claude.com/docs/en/about-claude/models/overview), [direct API context windows](https://platform.claude.com/docs/en/build-with-claude/context-windows), [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). OpenRouter’s aggregate Sonnet 4.5 catalog advertises a larger window than the current direct Claude documentation; do not apply that aggregate limit to Sentinel’s Anthropic adapter.

**Google Gemini API.** These are model choices, with different quality and costs:

| Model ID | Input / output price | Input or shared context / maximum synchronous output | Free API? | Recommended use |
| --- | --- | --- | --- | --- |
| `gemini-4-argon` | $2 / $10 through 30 Nov 2026; $4 / $20 from 1 Dec | 1,048,576 shared / 65,536 | No | Strongest Google flagship candidate for complex reasoning and skeptical review |
| `gemini-3.8-flash` | $0.75 / $3.75 through 31 Dec 2026; $1.50 / $7.50 from 1 Jan 2027 | 1,048,576 input / 65,536 output | Yes, restricted | Best Google candidate for economical research, hypotheses and analysis |
| `gemini-3.5-flash-lite` | $0.30 / $2.50 | 1,048,576 input / 65,536 output | Yes, restricted | Best current execution-focused Google candidate for extraction and simple summaries |

All three are listed as stable and support structured outputs. Argon is positioned for complex software, scientific and mathematical reasoning. Flash 3.8 is a serious research candidate, rather than merely a cheap summarizer, but its ability to reject unsupported security conclusions needs testing. Flash-Lite should start with extraction and summaries; a large context window does not establish equal skeptical-review quality.

Argon and Flash 3.8 offer low, medium and high thinking levels. Flash 3.8 rejects `minimal`. Thinking consumes billable output tokens and time. A high-thinking setting can leave too little room for a complete 3k–4k structured answer under Sentinel’s budget, so evaluate the actual budget behavior.

Google also lists older cheaper models, including Gemini 3.1 Flash-Lite ($0.25/$1.50) and Gemini 2.5 Flash-Lite ($0.10/$0.40). They can be tested for tightly bounded summaries, but price alone is insufficient to choose them over Haiku 5.5. Gemini 3.6 Flash costs the same as 3.8 Flash on the current direct price sheet, giving little reason to start a new evaluation with 3.6.

Avoid choosing the older Pro/Flash names for a new integration: Google says requests to **Gemini 2.5 Pro will automatically route to Gemini 3.8 Flash from 1 December 2026**, and Gemini 2.5 Flash requests will route to Gemini 3.5 Flash-Lite. These are changes to both behavior and billing. Record the returned model version and watch retirement notices.

The paid Gemini API is suitable for a production evaluation. Free requests have more restrictive capacity and materially different data terms. Neither tier’s actual capacity should be inferred from a model’s context window.

Sources: [pricing and announced price changes](https://ai.google.dev/gemini-api/docs/pricing), [model catalog](https://ai.google.dev/gemini-api/docs/models), [Argon specification](https://aistudio.google.com/docs/models/gemini-4-argon), [Flash 3.8 specification](https://aistudio.google.com/docs/models/gemini-3.8-flash), [Flash-Lite specification](https://aistudio.google.com/docs/models/gemini-3.5-flash-lite), [deprecations](https://ai.google.dev/gemini-api/docs/deprecations).

**GroqCloud.** Groq supplies inference for models from other developers; Groq’s speed is not a model-quality score.

| Groq model ID | Input / output price | Context / maximum completion | Status | Assessment |
| --- | --- | --- | --- | --- |
| `openai/gpt-oss-120b` | $0.15 / $0.60 | 131,072 / 65,536 | Production | Best broadly available production research candidate on Groq; capable open reasoning, but unproven as a Sonnet replacement on Sentinel evidence |
| `openai/gpt-oss-20b` | $0.075 / $0.30 | 131,072 / 65,536 | Production | Strong cost and latency candidate for summaries, extraction and classification |
| `qwen/qwen3.8-27b` | $0.80 / $4 | 131,072 / 16,384 | Preview | Promising newer research challenger; compare against GPT-OSS 120B, and respect preview lifecycle restrictions |

The current catalog lists Llama 3.3 70B and Llama 3.1 8B as enterprise/contact-sales models. Muse Spark Open and MiniMax M2.7 are also enterprise/contact-sales preview entries. Older lists describing all these as freely available self-service choices are outdated. `openai/gpt-oss-safeguard-20b` is a safety specialist, not a substitute for Sentinel’s general evidence analyst.

Groq advertises approximately **500 tokens/s for GPT-OSS 120B**, **1,000 tokens/s for GPT-OSS 20B** and **450 tokens/s for Qwen 3.8 27B**. These are published model throughput figures, not measured end-to-end or p95 latency on a 60k Sentinel request.

Both GPT-OSS models and Qwen 3.8 support strict JSON Schema decoding on Groq. Set `response_format` to `json_schema` with `strict: true`; plain `json_object` only enforces JSON syntax. Groq currently says **streaming and tool use are unsupported with Structured Outputs**, so translate Sentinel’s schema into the response format rather than copying its forced Anthropic tool. Continue application validation and reject incomplete/refused responses.

Sources: [current supported models, prices, context and production status](https://console.groq.com/docs/models), [structured-output support and restrictions](https://console.groq.com/docs/structured-outputs), [reasoning controls](https://console.groq.com/docs/reasoning), [GPT-OSS publisher specification](https://developers.openai.com/api/docs/models/gpt-oss-120b).

**OpenRouter.** OpenRouter is a routing and billing service; assess the selected model **and the actual hosting endpoint**. Its live catalog returned 461 entries during this check. A model ID can have hosts with different context limits, quantization, price, throughput and data policies.

| OpenRouter model ID | Listed input / output rate | Context guidance | Assessment |
| --- | --- | --- | --- |
| `openai/gpt-6-astra` | $10 / $50 | 1.05M; 128k maximum output | Premium flagship reasoning candidate; poor default fit for this cost objective |
| `openai/gpt-6.1-sol` | $2 / $10 | 1.05M; 128k maximum output | Recommended balanced non-Anthropic research alternative |
| `openai/gpt-6-luna` | $0.10 / $0.50 | 1.05M; 128k maximum output | Competitive focused-summary/extraction alternative to Haiku 5.5 |
| `google/gemini-4-argon` | $2 / $10 currently | 1M shared; output depends on endpoint and decoding mode | Google’s flagship through a different API surface; direct Google pricing changes remain relevant |
| `anthropic/claude-sonnet-5.5` | $2 / $10 | 1M; 128k maximum output | Same model family as the recommended direct primary; evaluate hosting policy and fees |
| `anthropic/claude-haiku-5.5` | $0.10 / $0.50 for prompts ≤100k | 1M; 128k maximum output | Same summary candidate through the router |
| `deepseek/deepseek-v4-pro-0813` | Catalog quote $0.111 / $4.44 | 1M; endpoint-dependent output limit | Serious low-cost reasoning challenger; verify the host and review precision |
| `deepseek/deepseek-v4.1-flash-1017` | Relace FP4 endpoint: $0.006 / $0.50 | 1M on that endpoint | Extremely cheap research/summary challenger; price and quantization make endpoint-level testing essential |
| `minimax/minimax-m3.1-flash` | $0.15 / $0.60, with time-based overrides | 1M; endpoint-dependent output limit | Competitive low-cost candidate; publisher positions it for coding and complex work including cybersecurity |
| `nvidia/nemotron-3.5-super-vl:free` | $0 / $0 | 1M; 131,072 maximum output in the catalog | Free public/synthetic research candidate with listed strict-output capability; current Nvidia endpoint prohibits confidential input |
| `google/gemma-4-31b-it:free` | $0 / $0 | 262,144; 32,768 maximum output in the catalog | Useful free extraction/summary and local-model comparison candidate; strict-output capability was not listed |

These are catalog or explicitly identified endpoint quotes, rather than a universal tariff for every host. For example, the same DeepSeek Flash snapshot has Relace FP4, Morph FP8 and numerous other endpoints with different prices. A constrained, approved production route can cost more than the lowest catalog quote. Google Flash 3.8’s OpenRouter catalog quote was $0.825/$4.125, compared with $0.75/$3.75 directly from Google at the time of the check.

OpenRouter’s Standard plan charges a **5.5% platform fee** when buying credits; Business lists **8%**. Inference prices pass through the selected host’s rates. BYOK currently has a $25,000/month list-price inference allowance before a 5% fee on excess usage; this is not a free allowance for model inference.

Use native JSON Schema where the selected endpoint supports it, set `require_parameters: true`, and constrain the model and provider/endpoint. The catalog’s aggregate parameter list does not prove every host supports that parameter. For reproducibility, put approved fallback choices in Sentinel’s existing orchestration policy, and record the host, returned model, attempts and actual usage. Avoid an automatically changing `openrouter/free` or latest-model alias for security evidence review.

Sources: [live model catalog](https://openrouter.ai/api/v1/models), [specific DeepSeek Flash endpoints and prices](https://openrouter.ai/api/v1/models/deepseek/deepseek-v4.1-flash-1017/endpoints), [platform pricing](https://openrouter.ai/pricing), [fees and BYOK](https://openrouter.ai/docs/faq), [provider selection](https://openrouter.ai/docs/guides/routing/provider-selection), [structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs).

**Ollama local inference and Ollama Cloud need separate evaluations.** Local Ollama exposes an API for a model running on Sentinel-controlled hardware. Its software/model API has no per-token vendor charge; GPU capacity, electricity, operations and availability still cost money.

| Local model tag | Published context | Approximate model download size | Recommended starting role |
| --- | --- | --- | --- |
| `qwen3.8:27b` | 256k | 18 GB | Practical local research and hypothesis candidate to evaluate first |
| `gpt-oss:120b` | 128k | 65 GB | Larger text reasoning candidate when sufficient memory is available |
| `gpt-oss:20b` | 128k | 14 GB | Summaries and extraction |
| `gemma4:31b` | 256k | 19–20 GB | Alternative local research/extraction candidate |
| `gemma4:12b` | 256k | 7.7–8.0 GB | Smaller local extraction and summary candidate |
| `nemotron-3.5-super:120b` | 1M | 80–90 GB | Larger multimodal reasoning/document candidate; substantial hardware requirement |

Download size is **not a full RAM/VRAM estimate**: add KV cache, runtime and concurrency requirements. The largest model is not automatically the best choice. Quality must be tested on the exact tag/digest and quantization.

Ollama’s runtime context default depends on available VRAM: documentation lists 4k below 24 GiB, 32k at 24–48 GiB, and 256k at 48 GiB or more. Set an appropriate `num_ctx` and check the loaded context; a 256k-capable model can otherwise run with a much smaller usable window. Preserve Sentinel’s 30k–60k input and 2k–4k output allowances within that runtime capacity.

Local Ollama supports a JSON Schema in the `format` field, including through its OpenAI-compatible response format. This helps syntax/schema reliability; it does not make the evidence or conclusions correct. A CPU-heavy or partially offloaded 60k request may miss Sentinel’s 45-second timeout. Benchmark prompt processing as well as token generation.

Ollama Cloud now charges **per token**, including on its $0/month Pay as you go plan. Examples include GPT-OSS 120B at $0.15/$0.60, GPT-OSS 20B at $0.07/$0.30, MiniMax M3.1 Flash at $0.15/$0.60, Mistral Large 4 at $0.70/$2.10 and Kimi K3.1 Pro at $2/$10. These are actual hosted model choices, distinct from the local Qwen candidate.

Pro costs $20/month with $60 of monthly usage credits; Max costs $100 with $300; Team costs $500 with $1,000 shared credits. Included credits do not roll over. Pay as you go and Pro allow 3 concurrent requests; Max and Team allow 10, with a bounded queue.

**Ollama Cloud currently does not support native structured outputs.** It supports capable models and tool calling, but its schema-enforcement gap makes it a weaker fit than local Ollama or Groq for Sentinel’s dedicated JSON tasks. Its privacy terms say prompts/responses are processed transiently and never logged or used for training. Cloud processing is primarily in the US, with possible routing to Europe.

Sources: [Qwen3.8](https://ollama.com/library/qwen3.8), [GPT-OSS](https://ollama.com/library/gpt-oss), [Gemma 4](https://ollama.com/library/gemma4), [Nemotron 3.5 Super](https://ollama.com/library/nemotron-3.5-super), [runtime context defaults](https://docs.ollama.com/context-length), [structured outputs and cloud restriction](https://docs.ollama.com/capabilities/structured-outputs), [cloud prices and plan limits](https://ollama.com/pricing), [privacy policy](https://ollama.com/privacy).

**Three other options deserve consideration for different reasons.** Direct OpenAI is a competitive general replacement, direct DeepSeek provides low token costs, and Cerebras provides high throughput:

**OpenAI directly:** `gpt-6.1-sol` is the recommended balanced research alternative at $2/$10; `gpt-6-luna` is the summary/extraction alternative at $0.10/$0.50. Both have a 1.05M context, 128k maximum output and structured-output support. Astra is the publisher’s most capable general flagship, but costs $10/$50. These are paid API models; a free ChatGPT account is not free access to these APIs. Direct OpenAI avoids OpenRouter’s credit fee and an additional routing dependency. Luna’s Chat Completions function calling requires `reasoning_effort: none`; check the selected API contract rather than copying an Anthropic request.

Sources: [official OpenAI model selection and prices](https://developers.openai.com/api/docs/models), [API pricing](https://developers.openai.com/api/docs/pricing), [Sol specification and limits](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Luna specification and limits](https://developers.openai.com/api/docs/models/gpt-6-luna). The OpenAI Docs skill was used for this part of the evaluation.

**DeepSeek directly:** the current API models are `deepseek-flash` = **DeepSeek V4.1 Flash 1017**, and `deepseek-v4-pro` = **DeepSeek V4 Pro 0813**. Both have a 1M context and a published maximum output of 384k. Both support thinking and non-thinking modes; thinking is the default. DeepSeek documents OpenAI-format and Anthropic-format API surfaces. API compatibility does not establish identical schema enforcement or usage accounting.

| Direct DeepSeek model | Uncached input, off-peak / peak | Cached input, off-peak / peak | Output, off-peak / peak |
| --- | --- | --- | --- |
| V4.1 Flash 1017 | $0.15 / $0.30 | $0.003 / $0.006 | $0.60 / $1.20 |
| V4 Pro 0813 | $0.66 / $1.32 | $0.022 / $0.044 | $1.98 / $3.96 |

Peak hours are 01:00–04:00 and 06:00–10:00 UTC on weekdays, excluding Chinese public holidays; all other periods are off-peak. Do not quote the very low cached-input rate as the cost of a new uncached prompt. The direct API’s documented JSON mode uses `json_object`; native strict response-schema enforcement was not established here. DeepSeek is a serious low-cost benchmark candidate, but the API-specific privacy contract needs further confirmation before confidential evidence is sent.

DeepSeek’s JSON documentation also warns that non-JSON generations may be replaced with whitespace, leaving an apparently empty result even when `finish_reason` is `stop`. Treat that as invalid output and apply Sentinel’s bounded corrective retry; a normal stop marker alone is insufficient.

Sources: [actual models, rates and price periods](https://api-docs.deepseek.com/quick_start/pricing), [JSON mode](https://api-docs.deepseek.com/guides/json_mode), [rate limits](https://api-docs.deepseek.com/quick_start/rate_limit).

**Cerebras:** a competitive speed alternative serving `gpt-oss-120b` and `qwen-3.8-27b`, with advertised throughput around 3,000 and 1,850 tokens/s respectively. Its catalog lists approximately 65k/131k free/paid context for GPT-OSS and 64k/128k for Qwen. The current promotional offer is a **one-time $5 credit after adding a payment method, expiring after 30 days**, with no automatic paid enrollment. Treat this as a trial, rather than an ongoing free production allowance. A fresh full Sentinel request is also constrained by the trial’s 30k uncached TPM limit. This is worth considering when latency matters more than the lowest token rate; it does not change the model’s identity or establish better evidence-review accuracy.

Sources: [available models and compression policy](https://inference-docs.cerebras.ai/models/overview), [trial terms](https://inference-docs.cerebras.ai/support/pricing), [trial and paid throughput limits](https://inference-docs.cerebras.ai/support/rate-limits).

**Genuine free API access exists, but the usable allowance matters as much as the model window.** The following restrictions determine whether a full Sentinel task fits:

| Provider/access | Published free allowance or restriction | Paid capacity/restrictions relevant to Sentinel |
| --- | --- | --- |
| Gemini API | Free token inference for Flash 3.8 and Flash-Lite 3.5; actual RPM, input TPM and RPD are project/model/account-specific and currently shown in AI Studio rather than a universal public quota table. Argon has no free API tier. | Paid Tier 1 requires billing; published billing-tier cap $250 and spend-rate limit $10 per rolling 10 minutes. Token/request quotas remain account-specific. |
| Groq GPT-OSS 120B / 20B | Each listed with 30 RPM, 1,000 RPD, 8k TPM and 200k TPD in the current Free Plan table. Qwen 3.8 has the same published free limits. | Model pages list Developer capacity of 1,000 RPM and 250k TPM for these models; account limits may differ. |
| OpenRouter `:free` models | 20 RPM and 50 requests/day across free models with less than $10 in purchased credits; 1,000/day after purchasing at least $10. The higher allowance requires a purchase. | No universal paid-model platform RPD cap; upstream capacity, available credits, in-flight budget and configured spend caps still apply. |
| Local Ollama | No model-inference API token fee or vendor RPM/RPD allowance; resource capacity and model licenses govern practical use. | Hardware, memory, queueing and operation of the local service determine availability and latency. |
| Ollama Cloud | The $0/month plan charges for inference; it is not a continuing free token allowance. | 3 concurrent requests on Pay as you go/Pro; 10 on Max/Team; queue has a fixed bound. |
| Direct OpenAI | The selected Sol and Luna model pages explicitly list Free as unsupported. | Published Build maxima: 5,000 RPM and 1M TPM for Sol; 5,000 RPM and 2M TPM for Luna. Actual account eligibility/limits apply. |
| Direct Anthropic | No recurring free production API allowance established in these sources. | Published Start maxima for Sonnet 5.5/Haiku 5.5: 4,000 RPM, 2M input TPM and 400k output TPM, with a $500 monthly spend cap. New organizations may have lower Evaluation-tier limits. |
| Direct DeepSeek | No recurring free API allowance established; granted/promotional balances are separate from a permanent free tier. | Published concurrency limits: 2,500 Flash requests and 500 Pro requests; this is not a token-throughput or latency guarantee. |
| Cerebras trial | One-time $5 promotional credit, 30-day expiry; 5 RPM, 30k uncached TPM, 90k total TPM and 1M tokens/day. | Paid GPT-OSS: 1M uncached TPM, 3M total TPM, 1,000 RPM. Paid Qwen: 150k uncached TPM, temporarily 750k total TPM, 300 RPM. |

**Groq’s free tier does not accommodate Sentinel’s unchanged full 30k–60k requests under its published 8k TPM limit**, even though the models have 131k context windows. Waiting several minutes does not make the documented bucket capacity equal a 60k prompt. It remains useful for smaller experiments; the paid tier fits the task sizes.

Gemini’s free quota must be checked on Sentinel’s actual project. Its rate limits are per project, not per API key; RPD resets at midnight Pacific time. Google explicitly states that capacity is not guaranteed. OpenRouter free limits are shared across free-model requests; suitable free hosts can also be unavailable or overloaded.

The current OpenRouter catalog includes free Nemotron 3.5 Super VL, Gemma 4 31B/26B and several other models. It **did not list `openai/gpt-oss-120b:free`** at this check. Free Groq access to GPT-OSS and paid OpenRouter access to GPT-OSS are different offers.

Sources: [Gemini rate limits and billing tiers](https://ai.google.dev/gemini-api/docs/rate-limits), [Groq Free Plan limits](https://console.groq.com/docs/rate-limits), [Groq Developer model limits](https://console.groq.com/docs/models), [OpenRouter free/paid restrictions](https://openrouter.ai/docs/api-reference/limits), [Anthropic tier limits and starting-tier caveat](https://platform.claude.com/docs/en/api/rate-limits).

**Privacy, retention and production readiness.** Policies belong to the processing provider and endpoint, rather than to an open-weight model name.

| Processing route | Training policy | Retention/processing consequence |
| --- | --- | --- |
| Unpaid Gemini outside EEA/UK/Switzerland | Content can be used to improve products and machine-learning technologies; human reviewers may inspect input/output. | Google explicitly says not to submit sensitive, confidential or personal information. Appropriate for public/synthetic evaluation cases. |
| Paid Gemini project | No use of prompts/responses to improve general products; abuse-monitoring data can support models used specifically for policy enforcement. | Published abuse retention is 55 days; flagged content can receive authorized human review. Paid service is not a general ZDR promise; terms allow transient/cache processing in countries with Google facilities. |
| Groq | No training/fine-tuning on inputs/outputs without explicit customer permission. | Inference content not retained by default; reliability/abuse logs may be retained up to 30 days. All customers can enable ZDR in Data Controls. Metadata persists; retained customer content is stored in US GCP buckets. |
| OpenRouter | Own prompt/completion logging is off by default; upstream training depends on the endpoint and separate paid/free privacy settings. | Choose the permitted policy tier and approved host. `zdr: true` alone can still allow Safety Retention under self-service defaults. Set the account/guardrail to ZDR only when required. |
| Local Ollama | Ollama does not receive local prompts/responses or train on them. | Best option for direct control of data location; Sentinel still controls its own logs, storage, network exposure and hardware operation. |
| Ollama Cloud | Prompts/responses are never trained on or routinely logged, according to its published policy. | Transient processing; primarily US hosting with possible Europe routing; account/usage metadata remains. |
| Direct Anthropic | No training on commercial API inputs/outputs by default; feedback or explicit permission can change this. | Standard deletion within 30 days, with service, policy and legal exceptions. Flagged policy-violation content can be retained up to 2 years; feedback data up to 5 years. Covered Models can have additional requirements. |
| Direct OpenAI | API inputs/outputs are not used for training unless the customer opts in. | Default abuse logs up to 30 days; Responses state is retained by default unless disabled. `store: false` does not disable abuse logs. Prompt-cache KV tensors can persist up to 24 hours. ZDR requires approval and has endpoint/model limitations. |
| Direct DeepSeek | The general service privacy policy permits training/improvement and provides an opt-out; an API-specific no-training/ZDR commitment was not established here. | General policy specifies PRC processing/storage and retention as necessary, without a fixed inference-content period. Confirm the API contract; do not substitute consumer-product policy for an API guarantee. |

Google’s EEA/UK/Switzerland terms have important distinctions: paid data-use terms apply to users in those regions even for unpaid services, and **API clients made available to users in those regions must use Paid Services**. A paid Gemini project is defined by an active linked billing account.

OpenRouter currently describes **ZDR**, **Safety Retention** and **Retention and Training** as separate endpoint tiers. Safety Retention permits keeping content from requests for abuse prevention without general training. Published ZDR guidance also describes CSAM/legal retention exceptions. Selecting ZDR only can remove first-party Google, OpenAI or Anthropic routes and leave the desired model unavailable. Regional processing and some policy-routing controls depend on the plan. A US/EU-hosted DeepSeek model should be assessed under that host’s contract; the model’s publisher does not establish where that endpoint processes the evidence.

Free Gemini and generic free-router traffic are unsuitable defaults for confidential security evidence. Groq with enabled ZDR is attractive for privacy and speed when its paid capacity is used. Local Ollama provides the strongest location control when hardware and operational requirements are affordable. None of these choices transfers authority for security decisions away from Sentinel’s reviewers.

Sources: [Gemini terms](https://ai.google.dev/gemini-api/terms), [Gemini 55-day abuse policy](https://ai.google.dev/gemini-api/docs/usage-policies), [Groq retention and self-service ZDR](https://console.groq.com/docs/your-data), [Groq Services Agreement §4.2](https://console.groq.com/docs/legal/services-agreement), [OpenRouter endpoint policies](https://openrouter.ai/docs/guides/features/zdr), [OpenRouter logging policies](https://openrouter.ai/docs/guides/privacy/provider-logging), [Ollama privacy](https://ollama.com/privacy), [Anthropic commercial retention](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data), [Anthropic commercial training policy](https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training), [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data), [DeepSeek general service privacy policy and its scope](https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html).

**Cost at Sentinel’s task sizes.** These examples use uncached standard interactive inference, 60k input plus **4k total billed output** for research, and 30k input plus **2k total billed output** for summaries. Output includes any billed reasoning. They exclude retries, cache operations, batch discounts, tools, tax, currency conversion, hardware and platform fees.

| Model | 60k + 4k research call | 30k + 2k summary call |
| --- | ---: | ---: |
| Claude Sonnet 4.5 | $0.2400 | $0.1200 |
| Claude Haiku 4.5 | $0.0800 | $0.0400 |
| Claude Sonnet 5.5 / GPT-6.1 Sol | $0.1600 | $0.0800 |
| Claude Haiku 5.5 / GPT-6 Luna | $0.0080 | $0.0040 |
| Gemini 4 Argon, current / from 1 Dec | $0.1600 / $0.3200 | $0.0800 / $0.1600 |
| Gemini 3.8 Flash, current / from 1 Jan | $0.0600 / $0.1200 | $0.0300 / $0.0600 |
| Gemini 3.5 Flash-Lite | $0.0280 | $0.0140 |
| Groq GPT-OSS 120B | $0.0114 | $0.0057 |
| Groq GPT-OSS 20B | $0.0057 | $0.00285 |
| DeepSeek V4.1 Flash on Relace FP4 through OpenRouter | $0.00236 | $0.00118 |

For 1,000 research calls plus 1,000 summary calls at those sizes:

| Routing combination | Token cost | Interpretation |
| --- | ---: | --- |
| Current Sonnet 4.5 + Haiku 4.5 | $280 | Incumbent comparison |
| Sonnet 5.5 + Haiku 5.5 | $164 | About 41% lower; least provider-migration effort |
| Direct GPT-6.1 Sol + GPT-6 Luna | $164 | Competitive non-Anthropic pair, before comparing task quality |
| Gemini 3.8 Flash + Haiku 5.5 | $64 currently; $124 from 1 Jan | Best practical cost challenger after research-task validation |
| 80% Gemini 3.8 research, 20% Sonnet 5.5 research, all summaries Haiku 5.5 | $84 currently; $132 from 1 Jan | Illustrative two-provider mix; actual task distribution determines savings |
| Gemini 4 Argon + Haiku 5.5 | $164 currently; $324 from 1 Dec | Argon’s temporary price makes a large difference; not the lowest-cost default after the increase |
| Groq GPT-OSS 120B + GPT-OSS 20B | $14.25 | Cheap token inference, with research-quality equivalence unestablished |
| OpenRouter/Relace DeepSeek Flash + Haiku 5.5 | $6.36 plus router fees | Very low token quote; selected-endpoint quality, data policy and availability still need validation |

A model that needs repeated schema repair, produces more false positives, or consumes more human review can cost more per accepted result despite a lower token price. Compare accepted, evidence-grounded results and reviewer time alongside the invoice.

**Assign models through the existing single orchestrator.** The following task mapping preserves the current responsibilities and separates primary recommendations from models that still need task-specific validation:

| Existing task | Primary recommendation | Candidate for lower-cost routing after validation |
| --- | --- | --- |
| Recon, attack-surface analysis, pattern analysis, hypothesis generation | Sonnet 5.5 | Paid Gemini 3.8 Flash; then evaluate a pinned DeepSeek/MiniMax/GPT-OSS deployment |
| Evidence review, false-positive review | Sonnet 5.5 | GPT-6.1 Sol or Gemini 4 Argon as strong alternative reasoning candidates; promote cheaper models only with skeptical-review results |
| Report generation | Sonnet 5.5 | Gemini 3.8 Flash after source-link, coverage and qualifier checks |
| Finding and session summaries | Haiku 5.5 | GPT-6 Luna; Groq GPT-OSS 20B when speed or ZDR is a material benefit |
| Public/synthetic exploratory comparison | Gemini 3.8 Flash free tier | OpenRouter Nemotron 3.5 Super VL `:free` |
| Work requiring local processing | Qwen3.8:27b local Ollama | Compare local Gemma 4, GPT-OSS and Nemotron on the exact available hardware |

The primary recommendation is **Sonnet 5.5 + Haiku 5.5 on Anthropic directly**, with **paid Google Gemini 3.8 Flash** as the main route to further savings. This avoids making the application dependent on free availability and keeps the provider count small. OpenRouter is useful for comparing multiple models or selecting a contracted host; it is not necessary for the Google/Anthropic primary combination. Groq deserves a production role when its speed or self-service ZDR is valuable. Ollama deserves one when local processing justifies the hardware and operational cost.

**What to measure before promoting a cheaper research model.** Use the same supplied evidence, prompts, schemas and budgets through the existing orchestrator for every candidate, with human-scored cases:

- Reasoning and hypothesis quality: correct preconditions, explicit assumptions, useful falsifiable hypotheses and recognition of missing evidence.
- Evidence grounding: valid source IDs, correct attribution, no invented observations/CVEs, and preserved distinctions between observed, inferred and unconfirmed claims.
- False-positive review: both false positives and missed real vulnerabilities, handling of benign controls and contradictory evidence, and appropriate uncertainty.
- JSON reliability: schema pass rate on the first response and after Sentinel’s one corrective retry; clean refusal/truncation handling and failure without adoption of invalid output.
- Long-context behavior: representative 30k, 40k and 60k inputs, including relevant evidence in the middle, distracting logs and conflicting sources.
- Consistency and latency: repeated cases, first-token and complete-response p50/p95, quota failures, retry frequency and adherence to the existing 45-second limit.
- Total cost: billed input, visible and reasoning output, cache writes/reads, failed/retried calls, and human review time per accepted result.

General model scores do not substitute for these measurements. A schema-correct output can contain a fabricated evidence reference or an unsupported conclusion. Require the same semantic checks and human authority for every provider.

**Budget/accounting compatibility.** Keep the existing task allowances. Count any billed thinking within the applicable budget and verify each API’s output-cap semantics. Provider-specific tokenization means the current four-characters-per-token estimate cannot establish exact cross-provider input usage. Normalize usage and refusals into the existing provider response contract, and retain attempt traceability.

The repository’s cost estimator currently prices **tiers** at the Sonnet 4.5/Haiku 4.5 rates. Even an Anthropic model-ID override to 5.5 would leave that estimate inaccurate until pricing is keyed to the actual provider/model and relevant price band. This is a necessary accounting adjustment for an eventual model change, rather than a reason to redesign orchestration.

This deliverable is a documentation/pricing/policy evaluation, including the follow-up zero-budget constraint. No live inference quality benchmark was performed, and no model/provider configuration was changed.
