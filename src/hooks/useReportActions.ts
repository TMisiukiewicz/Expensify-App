import {useMemo} from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import {
    getCombinedReportActions,
    getFilteredReportActionsForReportView,
    getOneTransactionThreadReportID,
    isCreatedAction,
    isMoneyRequestAction,
    isSentMoneyReportAction,
} from '@libs/ReportActionsUtils';
import {canEditReportAction} from '@libs/ReportUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import {getEmptyObject} from '@src/types/utils/EmptyObject';
import useOnyx from './useOnyx';

type UseReportActionsProps = {
    /** Report object */
    report: OnyxEntry<OnyxTypes.Report>;
    /** Chat report for transaction threads */
    chatReport: OnyxEntry<OnyxTypes.Report>;
    /** Report action ID from route parameters */
    reportActionIDFromRoute: string | undefined;
    /** Raw report actions from usePaginatedReportActions */
    unfilteredReportActions: OnyxTypes.ReportAction[];
    /** Parent report action */
    parentReportAction: OnyxEntry<OnyxTypes.ReportAction>;
    /** Visible transactions */
    visibleTransactions: OnyxTypes.Transaction[];
    /** Whether the app is offline */
    isOffline: boolean;
};

type UseReportActionsReturn = {
    /** Filtered report actions for display */
    reportActions: OnyxTypes.ReportAction[];
    /** Combined report actions including transaction thread actions */
    combinedReportActions: OnyxTypes.ReportAction[];
    /** Index of the linked message in report actions */
    indexOfLinkedMessage: number;
    /** Whether the linked message is available */
    isLinkedMessageAvailable: boolean;
    /** Whether the linked message page is ready for display */
    isLinkedMessagePageReady: boolean;
    /** Transaction thread report ID */
    transactionThreadReportID: string | undefined;
    /** Whether this is a sent money report */
    isSentMoneyReport: boolean;
    /** Last editable report action */
    lastReportAction: OnyxTypes.ReportAction | undefined;
};

function useReportActions({
    report,
    chatReport,
    reportActionIDFromRoute,
    unfilteredReportActions,
    parentReportAction,
    visibleTransactions,
    isOffline,
}: UseReportActionsProps): UseReportActionsReturn {
    // Filter report actions for display
    const reportActions = useMemo(() => getFilteredReportActionsForReportView(unfilteredReportActions), [unfilteredReportActions]);

    // Find index of linked message
    const indexOfLinkedMessage = useMemo(
        (): number => reportActions.findIndex((obj) => reportActionIDFromRoute && String(obj.reportActionID) === String(reportActionIDFromRoute)),
        [reportActions, reportActionIDFromRoute],
    );

    // Check if created action exists
    const doesCreatedActionExists = useMemo(() => !!reportActions?.findLast((action) => isCreatedAction(action)), [reportActions]);
    
    const isLinkedMessageAvailable = indexOfLinkedMessage > -1;

    // The linked report actions should have at least 15 messages (counting as 1 page) above them to fill the screen.
    // If the count is too high (equal to or exceeds the web pagination size / 50) and there are no cached messages in the report,
    // OpenReport will be called each time the user scrolls up the report a bit, clicks on report preview, and then goes back.
    const isLinkedMessagePageReady = isLinkedMessageAvailable && (reportActions.length - indexOfLinkedMessage >= CONST.REPORT.MIN_INITIAL_REPORT_ACTION_COUNT || doesCreatedActionExists);

    // Get transaction IDs from visible transactions
    const reportTransactionIDs = useMemo(() => visibleTransactions?.map((transaction) => transaction.transactionID), [visibleTransactions]);

    // Get transaction thread report ID
    const transactionThreadReportID = useMemo(() => 
        getOneTransactionThreadReportID(report, chatReport, reportActions ?? [], isOffline, reportTransactionIDs),
        [report, chatReport, reportActions, isOffline, reportTransactionIDs]
    );

    // Get transaction thread report actions
    const [transactionThreadReportActions = getEmptyObject<OnyxTypes.ReportActions>()] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${transactionThreadReportID}`, {
        canBeMissing: true,
    });

    // Combine report actions with transaction thread actions
    const combinedReportActions = useMemo(() => 
        getCombinedReportActions(reportActions, transactionThreadReportID ?? null, Object.values(transactionThreadReportActions)),
        [reportActions, transactionThreadReportID, transactionThreadReportActions]
    );

    // Check if this is a sent money report
    const isSentMoneyReport = useMemo(() => reportActions.some((action) => isSentMoneyReportAction(action)), [reportActions]);

    // Find last editable report action
    const lastReportAction = useMemo(() => 
        [...combinedReportActions, parentReportAction].find((action) => canEditReportAction(action) && !isMoneyRequestAction(action)),
        [combinedReportActions, parentReportAction]
    );

    return {
        reportActions,
        combinedReportActions,
        indexOfLinkedMessage,
        isLinkedMessageAvailable,
        isLinkedMessagePageReady,
        transactionThreadReportID,
        isSentMoneyReport,
        lastReportAction,
    };
}

export default useReportActions;