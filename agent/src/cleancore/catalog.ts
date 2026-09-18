/**
 * N-Guard — Built-in Clean Core Rule Catalog v1.0 (Phase 9)
 *
 * Versioned default rules for all six SAP S/4HANA extensibility techniques.
 * Rules carry explicit edition applicability — no technique is assumed
 * universally available (architecture rule 2).
 *
 * Rules are CODE, not prompt text (architecture rule 12).
 * Future Phase 12 adds DB-backed per-tenant overrides.
 *
 * Key facts encoded:
 *  - Classic Modifications: NOT available in S/4HANA Cloud Public Edition
 *  - Developer Extensibility (controlled): available On-Premise + Cloud Private;
 *    NOT available in Cloud Public Edition (key-user/BTP only)
 *  - Key-User Extensibility: available in all three editions
 *  - BTP Side-by-Side: available in all editions (the preferred Clean Core pattern)
 *  - Configuration: available in all editions
 *  - Standard Adoption: always preferred, always available
 */

import type { CleanCoreCatalog, CleanCoreRule, ExtensibilityTechnique } from './types.js';
import type { S4Edition } from '../types/index.js';

const ALL_EDITIONS: S4Edition[] = ['ON_PREMISE', 'CLOUD_PRIVATE', 'CLOUD_PUBLIC'];
const OP_AND_PCE  : S4Edition[] = ['ON_PREMISE', 'CLOUD_PRIVATE'];

const V = '1.0';

/** Default N-Guard Clean Core catalog — version 1.0. */
export const DEFAULT_CATALOG: CleanCoreCatalog = {
  version : V,
  name    : 'N-Guard Default Clean Core Catalog v1.0',
  rules   : [

    // ── STANDARD_ADOPTION (Tier 1) ────────────────────────────────────────────
    {
      id                        : 'cc-std-all',
      catalogVersion            : V,
      technique                 : 'STANDARD_ADOPTION',
      tier                      : 'TIER_1',
      applicableEditions        : ALL_EDITIONS,
      riskLevel                 : 'LOW',
      requiresArchitectureReview: false,
      requiresException         : false,
      sapRecommendation         : 'Always evaluate whether the standard SAP process meets the requirement without any extension. This is the highest-priority approach in Clean Core strategy.',
      evidenceBasis             : 'SAP Clean Core Strategy; SAP S/4HANA Best Practice Activation Guide',
      safeguards                : [
        'Document the business rationale for adopting the standard process.',
        'Review standard process with business stakeholders before proceeding to any extension.',
      ],
      alternatives              : [],
      constraints               : [
        'Requires process reengineering if the business currently uses a custom process.',
      ],
    },

    // ── CONFIGURATION (Tier 1) ────────────────────────────────────────────────
    {
      id                        : 'cc-config-all',
      catalogVersion            : V,
      technique                 : 'CONFIGURATION',
      tier                      : 'TIER_1',
      applicableEditions        : ALL_EDITIONS,
      riskLevel                 : 'LOW',
      requiresArchitectureReview: false,
      requiresException         : false,
      sapRecommendation         : 'Use standard SAP Customizing (IMG/SPRO) to configure the system. Configuration changes are upgrade-safe and do not constitute custom code.',
      evidenceBasis             : 'SAP Customizing Guide; SAP S/4HANA Configuration Documentation',
      safeguards                : [
        'Transport all configuration through the standard transport landscape.',
        'Document the configuration change and business rationale in the change management system.',
        'Validate configuration in development/quality before production.',
      ],
      alternatives              : ['STANDARD_ADOPTION'],
      constraints               : [
        'Limited to what SAP exposes via Customizing; cannot change core logic.',
        'Some configuration options differ between Public Cloud and On-Premise editions.',
      ],
    },

    // ── KEY_USER_EXTENSIBILITY (Tier 2) ──────────────────────────────────────
    {
      id                        : 'cc-keyuser-all',
      catalogVersion            : V,
      technique                 : 'KEY_USER_EXTENSIBILITY',
      tier                      : 'TIER_2',
      applicableEditions        : ALL_EDITIONS,
      riskLevel                 : 'LOW',
      requiresArchitectureReview: false,
      requiresException         : false,
      sapRecommendation         : 'Use SAP-provided key-user extensibility tools: Custom Fields, Custom Business Objects (CBO), BAdI implementations via the Fiori Launchpad, and Adaptation Transport Organizer (ATO). These are upgrade-stable and cloud-compatible.',
      evidenceBasis             : 'SAP In-App Extensibility Guide; SAP S/4HANA Cloud Key-User Extensibility Documentation',
      safeguards                : [
        'Only use SAP-released extensibility APIs and key-user tools.',
        'Test each extension in a sandbox before transporting.',
        'Document custom fields and business objects for upgrade planning.',
      ],
      alternatives              : ['CONFIGURATION', 'STANDARD_ADOPTION'],
      constraints               : [
        'Scope is limited to what SAP releases as extensible via key-user tools.',
        'Custom Fields are limited to specific contexts — not all SAP objects support them.',
        'In Cloud Public Edition, only ATO-compatible objects can be transported.',
      ],
    },

    // ── DEVELOPER_EXTENSIBILITY — On-Premise + Private Cloud ONLY (Tier 3) ──
    {
      id                        : 'cc-dev-op-pce',
      catalogVersion            : V,
      technique                 : 'DEVELOPER_EXTENSIBILITY',
      tier                      : 'TIER_3',
      applicableEditions        : OP_AND_PCE,   // NOT available in Cloud Public
      riskLevel                 : 'MEDIUM',
      requiresArchitectureReview: true,
      requiresException         : false,
      sapRecommendation         : 'On On-Premise and Cloud Private Edition, use SAP-released BAdI implementations, Enhancement Spots, and append structures where released by SAP. Prefer key-user extensibility first. Developer extensibility is NOT available in Cloud Public Edition.',
      evidenceBasis             : 'SAP ABAP Development Guide; SAP S/4HANA Extensibility Framework Documentation',
      safeguards                : [
        'Only implement BAdIs and Enhancement Spots released by SAP (check SE18/SE19).',
        'Never modify standard SAP objects directly (no modifications).',
        'Register all developer extensions in the architecture decision register.',
        'Plan upgrade impact assessment for each developer extension.',
        'Review against Clean Core Index (CCI) target.',
      ],
      alternatives              : ['KEY_USER_EXTENSIBILITY', 'BTP_SIDE_BY_SIDE'],
      constraints               : [
        'NOT applicable to SAP S/4HANA Cloud Public Edition — use BTP side-by-side instead.',
        'Carries upgrade risk — must be regression-tested on every upgrade.',
        'Requires ABAP developer expertise and system access.',
        'Impacts Clean Core Index (CCI) score.',
      ],
    },

    // ── BTP_SIDE_BY_SIDE (Tier 3) ─────────────────────────────────────────────
    {
      id                        : 'cc-btp-all',
      catalogVersion            : V,
      technique                 : 'BTP_SIDE_BY_SIDE',
      tier                      : 'TIER_3',
      applicableEditions        : ALL_EDITIONS,
      riskLevel                 : 'MEDIUM',
      requiresArchitectureReview: true,
      requiresException         : false,
      sapRecommendation         : 'Build extensions on SAP BTP using SAP-released APIs (OData, SOAP, Events). This is the preferred Clean Core extension pattern for complex requirements. Extensions run independently of the S/4HANA core and do not impact the Clean Core Index.',
      evidenceBasis             : 'SAP BTP Extension Suite Documentation; SAP Clean Core Strategy Guide; SAP API Business Hub',
      safeguards                : [
        'Only consume SAP-released, stable APIs (check SAP API Business Hub for stability).',
        'Avoid APIs classified as Internal or Deprecated.',
        'Design for loose coupling — extension must survive S/4HANA upgrades.',
        'Implement API versioning and error handling.',
        'Document API consumption in the architecture decision register.',
      ],
      alternatives              : ['KEY_USER_EXTENSIBILITY', 'DEVELOPER_EXTENSIBILITY'],
      constraints               : [
        'Requires SAP BTP subscription and capacity.',
        'Network latency between BTP and S/4HANA must be acceptable for the use case.',
        'Complex real-time scenarios may require event-driven architecture (SAP Event Mesh).',
        'API stability tier must be checked before production use.',
      ],
    },

    // ── CLASSIC_CUSTOM — On-Premise + Private Cloud ONLY (Tier 4) ────────────
    {
      id                        : 'cc-classic-op-pce',
      catalogVersion            : V,
      technique                 : 'CLASSIC_CUSTOM',
      tier                      : 'TIER_4',
      applicableEditions        : OP_AND_PCE,   // NOT available in Cloud Public
      riskLevel                 : 'CRITICAL',
      requiresArchitectureReview: true,
      requiresException         : true,
      sapRecommendation         : 'Classic Z/Y custom code, modifications to SAP standard objects, and non-released enhancements are NOT recommended. This approach carries the highest upgrade risk and negatively impacts the Clean Core Index. Use only as a last resort when all other techniques have been exhausted and a formal exception has been approved.',
      evidenceBasis             : 'SAP Clean Core Strategy; SAP S/4HANA Upgrade Guide; SAP Custom Code Migration Guide',
      safeguards                : [
        'Obtain formal architecture exception approval before implementation.',
        'Document business justification — why no standard/extensible alternative exists.',
        'Register in the Design Decision Register as a governance exception.',
        'Plan immediate refactoring roadmap to migrate to standard/BTP.',
        'Add to Custom Code Remediation Backlog.',
        'Assign upgrade impact assessment and regression test plan.',
      ],
      alternatives              : ['BTP_SIDE_BY_SIDE', 'DEVELOPER_EXTENSIBILITY', 'KEY_USER_EXTENSIBILITY'],
      constraints               : [
        'NOT applicable to SAP S/4HANA Cloud Public Edition.',
        'Every modification to SAP standard code is a supported deviation that requires re-application after upgrades.',
        'Increases SAP support effort and reduces supportability.',
        'Directly reduces Clean Core Index (CCI) score.',
        'May require SAP approval for some object types.',
      ],
    },

  ] satisfies CleanCoreRule[],
};

/**
 * Get rules applicable to a specific edition.
 * Always filters by edition — no technique is assumed cross-edition.
 */
export function getRulesForEdition(
  catalog  : CleanCoreCatalog,
  edition  : S4Edition,
  release? : string,
): CleanCoreRule[] {
  return catalog.rules.filter(r => {
    if (!r.applicableEditions.includes(edition)) return false;
    if (r.applicableReleaseFrom && release && release < r.applicableReleaseFrom) return false;
    if (r.applicableReleaseTo   && release && release > r.applicableReleaseTo)   return false;
    return true;
  });
}

/**
 * Get a rule for a specific technique in a specific edition.
 * Returns undefined if the technique is not applicable.
 */
export function getRuleForTechnique(
  catalog  : CleanCoreCatalog,
  technique: ExtensibilityTechnique,
  edition  : S4Edition,
  release? : string,
): CleanCoreRule | undefined {
  return getRulesForEdition(catalog, edition, release).find(r => r.technique === technique);
}
