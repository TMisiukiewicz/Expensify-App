/**
 * A derived value that contains information about the report
 */
type OnyxDerivedReport = {
    /** Whether the report has any violations that should display a RBR */
    hasAnyViolations: boolean;

    /** Whether the report requires attention from the current user */
    requiresAttentionFromCurrentUser: boolean;
};

/**
 * A derived value that contains information about all reports
 */
type OnyxDerivedReportsList = Record<string, OnyxDerivedReport>;

export type {OnyxDerivedReport, OnyxDerivedReportsList};
