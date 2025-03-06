import Onyx from 'react-native-onyx';
import type {OnyxCollection} from 'react-native-onyx';
import {getReportAction} from '@libs/ReportActionsUtils';
import {
    canUserWriteActionInReport,
    getAllReportErrors,
    getReasonAndReportActionThatRequiresAttention,
    hasAnyTransactionViolations,
    hasReportViolations,
    isReportOwner,
    isSettled,
} from '@libs/ReportUtils';
import SidebarUtils from '@libs/SidebarUtils';
import createOnyxDerivedValueConfig from '@userActions/OnyxDerived/createOnyxDerivedValueConfig';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';

// we don't want to recalculte computed values when report Actions change, so we're caching the reportActions in a variable
let reportActions: Record<string, OnyxTypes.ReportActions | undefined>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT_ACTIONS,
    callback: (value) => (reportActions = value),
    waitForCollectionCallback: true,
});

let reportNameValuePairs: OnyxCollection<OnyxTypes.ReportNameValuePairs>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS,
    callback: (value) => (reportNameValuePairs = value),
    waitForCollectionCallback: true,
});

export default createOnyxDerivedValueConfig({
    key: ONYXKEYS.DERIVED.BRICK_ROAD_STATUS,
    dependencies: [ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS],
    compute: ([reports, transactionViolations]) => {
        if (!reports) {
            return {};
        }

        return Object.values(reports).reduce<OnyxTypes.ReportBrickRoadStatus>((acc, report) => {
            if (!report) {
                return acc;
            }
            const reportActionsList = reportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.reportID}`];
            const hasTransactionViolations = hasAnyTransactionViolations(report, transactionViolations);
            const isReportSettled = isSettled(report);
            const hasAnyReportViolations = !isReportSettled && isReportOwner(report) && hasReportViolations(report.reportID);
            const reasonAndReportActionWithRBR = SidebarUtils.getReasonAndReportActionThatHasRedBrickRoad(report, reportActionsList, hasTransactionViolations, hasAnyReportViolations);
            const parentReportAction = getReportAction(report?.parentReportID, report?.parentReportActionID);
            const requiresAttentionFromCurrentUser = getReasonAndReportActionThatRequiresAttention(report, parentReportAction);
            const errors = getAllReportErrors(report, reportActionsList);
            const canPerformWriteAction = canUserWriteActionInReport(report);

            acc[report.reportID] = {
                reasonToHaveRBR: reasonAndReportActionWithRBR,
                reasonToHaveGBR: requiresAttentionFromCurrentUser,
                errors,
                reportNameValuePairs: reportNameValuePairs?.[`${ONYXKEYS.COLLECTION.REPORT_NAME_VALUE_PAIRS}${report.reportID}`],
                canUserPerformWriteAction: canPerformWriteAction ?? false,
            };

            return acc;
        }, {});
    },
});
