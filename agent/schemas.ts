import { z } from "zod";
import { Constants, type Enums } from "../lib/database.types";

export type Category = Enums<"requirement_category">;
export type RequirementStatus = Enums<"requirement_status">;

export const CATEGORIES = Constants.public.Enums
  .requirement_category as readonly Category[];

/**
 * Question-targeting priority: core product shape first, cross-cutting
 * concerns last. Order is strict — an unresolved core category is always
 * targeted before a peripheral one, regardless of missing vs ambiguous.
 */
export const CATEGORY_PRIORITY: readonly Category[] = [
  "data_model",
  "auth_roles",
  "payments",
  "integrations",
  "notifications",
  "security_compliance",
  "non_functional",
];

// ── extract_requirements (LLM, structured) ───────────────────────────

const CategoryExtraction = z.object({
  captured: z
    .enum(["explicit", "vague", "absent"])
    .describe(
      "explicit = the text clearly states this; vague = hinted at or partially specified; absent = not mentioned at all"
    ),
  value: z
    .string()
    .nullable()
    .describe(
      "One-to-two sentence summary of what the text says about this category, quoting/paraphrasing the user. null when absent."
    ),
});

export const ExtractionSchema = z.object({
  auth_roles: CategoryExtraction.describe(
    "Who the users are, roles, permissions, sign-up/sign-in method"
  ),
  data_model: CategoryExtraction.describe(
    "Core entities, their fields and relationships"
  ),
  payments: CategoryExtraction.describe(
    "Monetization, pricing, billing, payment providers"
  ),
  notifications: CategoryExtraction.describe(
    "Emails, push, in-app alerts — what triggers them, who receives them"
  ),
  security_compliance: CategoryExtraction.describe(
    "Data protection, privacy, regulatory requirements (GDPR, HIPAA, ...)"
  ),
  integrations: CategoryExtraction.describe(
    "Third-party services, APIs, imports/exports"
  ),
  non_functional: CategoryExtraction.describe(
    "Performance, scale, availability, platforms (web/mobile), offline"
  ),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

// ── detect_gaps output (pure code — typed, no LLM) ───────────────────

export type Gap = {
  status: RequirementStatus;
  resolvedValue: string | null;
};

export type GapReport = Record<Category, Gap>;

// ── generate_requirements_doc (LLM, structured) ──────────────────────

export const DocSchema = z.object({
  user_stories: z
    .array(z.string())
    .describe(
      'User stories, each exactly in the form "As a [role], I want [goal], so that [reason]"'
    ),
  acceptance_criteria: z
    .array(z.string())
    .describe(
      'Testable acceptance criteria, each exactly in the form "Given [context], when [action], then [outcome]", traceable to a user story'
    ),
  assumptions: z
    .array(z.string())
    .describe(
      "Every assumption made. MUST include one entry per unresolved category, explicitly named, with a stated v1 default."
    ),
  risks: z
    .array(z.string())
    .describe("Delivery and product risks specific to this idea — no boilerplate"),
});

export type RequirementsDoc = z.infer<typeof DocSchema>;
