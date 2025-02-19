import type {Errors} from './OnyxCommon';

/**
 * A derived value that contains information about the report
 */
type OnyxDerivedReport = {
    /** Whether the report has any violations that should display a RBR */
    hasAnyViolations: boolean;

    /** Whether the report requires attention from the current user */
    requiresAttentionFromCurrentUser: boolean;

    /** All errors for the report */
    errors: Errors;

    /** Whether the user can perform write actions on the report */
    canUserPerformWriteAction: boolean;
};

/**
 * A derived value that contains information about all reports
 */
type OnyxDerivedReportsList = Record<string, OnyxDerivedReport>;

/**
 * Report attributes derived from the report data
 */
type OnyxDerivedReportAttibutes = Record<
    string,
    {
        /**
         *
         */
        isThread: boolean;
        /**
         *
         */
        isChatThread: boolean;
        /**
         *
         */
        isChatRoom: boolean;
        /**
         *
         */
        isChatReport: boolean;
        /**
         *
         */
        isInvoiceRoom: boolean;
        /**
         *
         */
        isTaskReport: boolean;
        /**
         *
         */
        isInvoiceReport: boolean;
        /**
         *
         */
        isPolicyExpenseChat: boolean;
        /**
         *
         */
        isExpenseRequest: boolean;
        /**
         *
         */
        isExpenseReport: boolean;
        /**
         *
         */
        isMoneyRequestReport: boolean;
        /**
         *
         */
        isSelfDM: boolean;
        /**
         *
         */
        isConciergeChat: boolean;
        /**
         *
         */
        isSystemChat: boolean;
        /**
         *
         */
        isDefaultRoom: boolean;
        /**
         *
         */
        isUserCreatedPolicyRoom: boolean;
        /**
         *
         */
        isTripRoom: boolean;
        /**
         *
         */
        isChildReport: boolean;
        /**
         *
         */
        isIOURequest: boolean;
        /**
         *
         */
        isTrackExpenseReport: boolean;
    }
>;

export type {OnyxDerivedReport, OnyxDerivedReportsList, OnyxDerivedReportAttibutes};
