import type {OnyxEntry} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import {getReportAction} from '@libs/ReportActionsUtils';
import {getReasonAndReportActionThatRequiresAttention, hasAnyTransactionViolations, hasReportViolations, isReportOwner, isSettled} from '@libs/ReportUtils';
import SidebarUtils from '@libs/SidebarUtils';
import createOnyxDerivedValueConfig from '@userActions/OnyxDerived/createOnyxDerivedValueConfig';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';

// we don't want to recalculte computed values when report Actions change, so we're caching the reportActions in a variable
let reportActions: OnyxEntry<OnyxTypes.ReportActions>;
Onyx.connect({
    key: ONYXKEYS.COLLECTION.REPORT_ACTIONS,
    callback: (value) => (reportActions = value),
});

export default createOnyxDerivedValueConfig({
    key: ONYXKEYS.DERIVED.BRICK_ROAD_STATUS,
    dependencies: [ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS],
    compute: ([reports, transactionViolations]) => {
        if (!reports || !transactionViolations) {
            return {};
        }

        return Object.values(reports).reduce<OnyxTypes.ReportBrickRoadStatus>((acc, report) => {
            if (!report) {
                return acc;
            }

            const hasTransactionViolations = hasAnyTransactionViolations(report, transactionViolations);
            const isReportSettled = isSettled(report);
            const hasAnyReportViolations = !isReportSettled && isReportOwner(report) && hasReportViolations(report.reportID);
            const reasonAndReportActionWithRBR = SidebarUtils.getReasonAndReportActionThatHasRedBrickRoad(report, reportActions, hasTransactionViolations, hasAnyReportViolations);
            const parentReportAction = getReportAction(report?.parentReportID, report?.parentReportActionID);
            const requiresAttentionFromCurrentUser = getReasonAndReportActionThatRequiresAttention(report, parentReportAction);

            acc[report.reportID] = {
                reasonToHaveRBR: reasonAndReportActionWithRBR,
                reasonToHaveGBR: requiresAttentionFromCurrentUser,
            };

            return acc;
        }, {});
    },
});
