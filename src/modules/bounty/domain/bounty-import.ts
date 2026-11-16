import { z } from "zod";

import { dateOnlySchema } from "@/modules/research/domain/fields";
import { projectInputSchema } from "@/modules/research/domain/project";
import { SCOPE_ASSET_EFFECTS, SCOPE_ASSET_MATCH_TYPES } from "@/modules/research/domain/scope";
import { assetTypeSchema, targetInputSchema } from "@/modules/research/domain/target";
import { capabilitySchema } from "@/modules/security/domain/capability";

export const BOUNTY_IMPORT_TOOL = "return_bounty_import";
export const MAX_BOUNTY_TEXT = 30_000;

export const bountySourceInputSchema = z
  .object({
    programUrl: z
      .string()
      .trim()
      .max(500)
      .refine((value) => {
        if (!value) return true;
        try {
          const url = new URL(value);
          return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
        } catch {
          return false;
        }
      }, "Enter a public http(s) program URL without credentials."),
    details: z.string().trim().max(MAX_BOUNTY_TEXT),
    readUrl: z.boolean(),
  })
  .superRefine((input, ctx) => {
    if (!input.details && (!input.programUrl || !input.readUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["details"],
        message: "Paste the program details or add a URL to read.",
      });
    }
  });
export type BountySourceInput = z.infer<typeof bountySourceInputSchema>;

// Nullable strings keep missing facts explicit in every provider's JSON schema.
export const bountyExtractionSchema = z.object({
  name: z.string().trim().max(80),
  description: z.string().trim().max(2000),
  programName: z.string().trim().max(120),
  authorizationNotes: z.string().trim().max(2000),
  effectiveFrom: z.string().nullable(),
  effectiveUntil: z.string().nullable(),
  assets: z
    .array(
      z.object({
        assetIdentifier: z.string().trim().min(1).max(255),
        assetType: assetTypeSchema,
        matchType: z.enum(SCOPE_ASSET_MATCH_TYPES),
        effect: z.enum(SCOPE_ASSET_EFFECTS),
        notes: z.string().trim().max(500),
        sourceQuote: z.string().trim().min(1).max(1000),
      }),
    )
    .max(50),
  warnings: z.array(z.string().trim().min(1).max(500)).max(20),
});
export type BountyDraft = z.infer<typeof bountyExtractionSchema> & {
  programUrl: string;
  sourceUrl: string | null;
};

const optionalDate = z.union([z.literal(""), dateOnlySchema]);
export const bountyReviewSchema = z
  .object({
    operationKey: z.string().min(8).max(160),
    importJobId: z.uuid(),
    project: projectInputSchema.extend({ projectType: z.literal("BUG_BOUNTY") }),
    programName: z.string().trim().max(120),
    programUrl: bountySourceInputSchema.shape.programUrl,
    authorizationSource: z
      .string()
      .trim()
      .min(3, "Add the policy URL or source of your permission.")
      .max(300),
    authorizationNotes: z.string().trim().max(2000),
    effectiveFrom: optionalDate,
    effectiveUntil: optionalDate,
    permittedActivities: z
      .array(capabilitySchema)
      .min(1, "Select at least one activity for the scope drafts.")
      .max(20),
    assets: bountyExtractionSchema.shape.assets,
    acknowledged: z.literal(true, {
      error: "Review the imported details and confirm before saving.",
    }),
  })
  .superRefine((input, ctx) => {
    if (input.effectiveFrom && input.effectiveUntil && input.effectiveUntil < input.effectiveFrom)
      ctx.addIssue({
        code: "custom",
        path: ["effectiveUntil"],
        message: "Choose an end date on or after the start date.",
      });
    if (!input.assets.some((asset) => asset.effect === "ALLOWED"))
      ctx.addIssue({
        code: "custom",
        path: ["assets"],
        message: "Add at least one allowed asset to create targets.",
      });
    const keys = new Set<string>();
    const targetKeys = new Set<string>();
    for (const [index, asset] of input.assets.entries()) {
      const key = `${scopeIdentifier(asset.assetIdentifier).toLowerCase()}::${asset.matchType}`;
      if (keys.has(key))
        ctx.addIssue({
          code: "custom",
          path: ["assets", index, "assetIdentifier"],
          message: "This asset is listed twice. Keep one rule for each identifier.",
        });
      keys.add(key);
      const identifier = scopeIdentifier(asset.assetIdentifier);
      if (asset.matchType === "DOMAIN" && asset.effect === "ALLOWED")
        ctx.addIssue({
          code: "custom",
          path: ["assets", index, "matchType"],
          message:
            "Use Exact for a named domain, or Subdomain for an explicit wildcard. Domain matching includes every subdomain.",
        });
      if (asset.matchType === "SUBDOMAIN" && !z.hostname().safeParse(identifier).success)
        ctx.addIssue({
          code: "custom",
          path: ["assets", index, "assetIdentifier"],
          message: "Subdomain rules need a domain such as *.example.com.",
        });
      if (asset.effect === "ALLOWED") {
        const targetKey = asset.assetIdentifier.toLowerCase();
        if (targetKeys.has(targetKey))
          ctx.addIssue({
            code: "custom",
            path: ["assets", index, "assetIdentifier"],
            message: "This allowed asset would create a duplicate target.",
          });
        targetKeys.add(targetKey);
        const target = targetInputSchema.safeParse(targetForAsset(asset, input));
        if (!target.success)
          for (const issue of target.error.issues)
            ctx.addIssue({
              code: "custom",
              path: ["assets", index, "assetIdentifier"],
              message: issue.message,
            });
      }
    }
  });
export type BountyReview = z.infer<typeof bountyReviewSchema>;

export function scopeIdentifier(identifier: string): string {
  return identifier.startsWith("*.") ? identifier.slice(2) : identifier;
}

export function targetForAsset(
  asset: BountyDraft["assets"][number],
  program: {
    programName: string;
    programUrl: string;
    authorizationSource: string;
    authorizationNotes: string;
  },
) {
  return {
    name: asset.assetIdentifier.slice(0, 100),
    description: asset.notes,
    assetIdentifier: asset.assetIdentifier,
    assetType: asset.assetIdentifier.startsWith("*.") ? ("OTHER" as const) : asset.assetType,
    environmentType: "BUG_BOUNTY_PROGRAM" as const,
    programName: program.programName,
    programUrl: program.programUrl,
    authorizationSource: program.authorizationSource,
    authorizationNotes: program.authorizationNotes,
  };
}

export function bountyFailureMessage(code: string | null): string {
  if (code === "BOUNTY_URL_BLOCKED")
    return "This URL cannot be read. Use a public program page or paste its policy and scope instead.";
  if (code === "BOUNTY_PAGE_UNAVAILABLE")
    return "The program page could not be read. It may require a login or block automated requests. Paste the policy and scope, then turn off Read program URL.";
  if (code === "AI_CONTEXT_TOO_LARGE")
    return "The program text exceeds this provider's allowance. Paste a shorter policy and scope, and turn off Read program URL.";
  if (code === "AI_BUDGET_EXCEEDED")
    return "Today's AI usage allowance has been reached. You can create the project manually or return later.";
  if (code === "AI_NOT_CONFIGURED" || code === "AI_NO_COMPATIBLE_MODEL")
    return "AI import is unavailable with the current provider configuration.";
  if (code === "BOUNTY_INVALID_OUTPUT")
    return "The AI result could not be verified against the supplied text. Try pasting the program's policy and scope directly.";
  return "The import could not finish. Your input is still here; try again or create the project manually.";
}
