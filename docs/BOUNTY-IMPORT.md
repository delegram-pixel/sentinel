# Import a bug bounty program

Open **Projects → New project → Import bounty with AI**. Paste a program URL,
program policy and scope text, or both. For private programs, turn off **Read
program URL** and paste the content you are permitted to share with the configured
AI provider. If a public page cannot be read and text was supplied, extraction
uses the pasted text and shows a warning.

Review the suggested project and program details, assets, exclusions, dates and
restrictions. Choose the permitted Sentinel activities and confirm the review.
Saving creates the project, one unverified target per allowed asset, and draft
scopes containing the relevant allowed asset and all exclusions. Nothing is
activated by the import. Missing dates stay empty. Use **Complete a scope
version** to carry forward the saved boundaries and add justified dates before
the existing activation and authorization attestation step.

Deploy the `20261116090000_bounty_program_import` migration and run the existing
research worker (`yarn worker`) with the same AI configuration as the app. Imports
use the configured provider or compatible route, privacy checks, provider quota,
and shared user token/spending budget. The development mock is clearly labelled
and returns empty suggestions. Production requires a live provider.

URL reads are limited to public HTTP(S) pages, standard ports, three redirects,
15 seconds and 1 MiB. DNS answers and redirects are validated, and the socket is
pinned to the validated address. The reader does not execute page JavaScript,
send credentials or cookies, follow policy links automatically, or access target
assets. Login pages, bot challenges and pages whose scope loads through
JavaScript may require pasted text. Source text is capped at 30,000 characters;
requests exceeding the configured model allowance fail with instructions to
paste shorter policy and scope text. Up to 50 assets can be reviewed.

Every extracted asset must cite a quote from the supplied text containing its
identifier. Imported named domains use exact matching; explicit wildcards use
subdomain matching. AI suggestions still need human verification, especially
scope completeness, authorization eligibility and policy restrictions.

Imports run as `BOUNTY_IMPORT` background jobs. The import URL contains its job
identifier so it can be reopened after navigation or refresh. Input text is
workspace private; the status endpoint returns only the draft and any saved
project ID. Completed imports are saved once in an atomic transaction, including
audit events. Interrupted requests with uncertain model delivery retain their
usage reservation and are not automatically repeated. A new import may be
started; deployment administrators should check provider usage before retrying
large interrupted requests.
