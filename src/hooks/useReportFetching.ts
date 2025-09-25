import type {RouteProp} from '@react-navigation/native';
import {useIsFocused} from '@react-navigation/native';
import {useCallback, useEffect} from 'react';
import {getIOUActionForReportID} from '@libs/ReportActionsUtils';
import {getReportTransactions, isChatThread, isHiddenForCurrentUser, isPolicyExpenseChat, isReportTransactionThread, isTaskReport} from '@libs/ReportUtils';
import type {ReportsSplitNavigatorParamList} from '@navigation/types';
import {setShouldShowComposeInput} from '@userActions/Composer';
import {createTransactionThreadReport, openReport, readNewestAction} from '@userActions/Report';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';
import type * as OnyxTypes from '@src/types/onyx';
import useIsAnonymousUser from './useIsAnonymousUser';
import useNetwork from './useNetwork';
import useOnyx from './useOnyx';
import usePrevious from './usePrevious';
import useResponsiveLayout from './useResponsiveLayout';

type ReportScreenRoute = RouteProp<ReportsSplitNavigatorParamList, typeof SCREENS.REPORT>;

type UseReportFetchingProps = {
    /** Report ID from route parameters */
    reportIDFromRoute: string | undefined;
    /** Report action ID from route parameters */
    reportActionIDFromRoute: string | undefined;
    /** Transaction thread report ID */
    transactionThreadReportID: string | undefined;
    /** Report actions for invitation detection */
    reportActions: OnyxTypes.ReportAction[];
    /** Whether the message page is ready for linking */
    isLinkedMessagePageReady: boolean;
    /** React Navigation route object */
    route: ReportScreenRoute;
};

function useReportFetching({reportIDFromRoute, reportActionIDFromRoute, transactionThreadReportID, reportActions, isLinkedMessagePageReady, route}: UseReportFetchingProps) {
    const isFocused = useIsFocused();
    const prevIsFocused = usePrevious(isFocused);
    const {shouldUseNarrowLayout} = useResponsiveLayout();

    // Fetch data directly using Onyx hooks
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportIDFromRoute}`, {canBeMissing: true});
    const [reportMetadata] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_METADATA}${reportIDFromRoute}`, {canBeMissing: true});
    const {isOffline} = useNetwork();
    const reportID = report?.reportID;
    const isAnonymousUser = useIsAnonymousUser();
    const [isLoadingReportData] = useOnyx(ONYXKEYS.IS_LOADING_REPORT_DATA);
    const [transactionThreadReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${transactionThreadReportID}`, {canBeMissing: true});
    const isTransactionThreadView = isReportTransactionThread(report);
    const lastReportIDFromRoute = usePrevious(reportIDFromRoute);

    // Previous values for comparison
    const prevIsAnonymousUser = usePrevious(isAnonymousUser);
    const prevIsLoadingReportData = usePrevious(isLoadingReportData);
    const prevTransactionThreadReportID = usePrevious(transactionThreadReportID);
    const prevReportActions = usePrevious(reportActions);

    // Create one transaction thread report when needed
    const createOneTransactionThreadReport = useCallback(() => {
        const currentReportTransaction = getReportTransactions(reportID).filter((transaction) => transaction.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE);
        const oneTransactionID = currentReportTransaction.at(0)?.transactionID;
        const iouAction = getIOUActionForReportID(reportID, oneTransactionID);
        createTransactionThreadReport(report, iouAction);
    }, [report, reportID]);

    // Main report fetching function
    const fetchReport = useCallback(() => {
        if (reportMetadata?.isOptimisticReport && report?.type === CONST.REPORT.TYPE.CHAT && !isPolicyExpenseChat(report)) {
            return;
        }

        if (report?.errorFields?.notFound && isOffline) {
            return;
        }

        // If there is one transaction thread that has not yet been created, we should create it.
        if (transactionThreadReportID === CONST.FAKE_REPORT_ID && !transactionThreadReport) {
            createOneTransactionThreadReport();
            return;
        }

        openReport(reportIDFromRoute, reportActionIDFromRoute);
    }, [
        reportMetadata?.isOptimisticReport,
        report,
        isOffline,
        transactionThreadReportID,
        transactionThreadReport,
        reportIDFromRoute,
        reportActionIDFromRoute,
        createOneTransactionThreadReport,
    ]);

    // Re-fetch data after anonymous user signs in
    useEffect(() => {
        // Only fetch if:
        // 1. Loading finished (isLoadingReportData false, was previously true)  
        // 2. User was anonymous but is no longer anonymous
        const wasLoadingAndFinished = !isLoadingReportData && prevIsLoadingReportData;
        const wasAnonymousAndSignedIn = prevIsAnonymousUser && !isAnonymousUser;
        
        if (wasLoadingAndFinished && wasAnonymousAndSignedIn) {
            // Re-fetch public report data after user signs in and OpenApp API is called to
            // avoid reportActions data being empty for public rooms.
            fetchReport();
        }
    }, [isLoadingReportData, prevIsLoadingReportData, isAnonymousUser, prevIsAnonymousUser, fetchReport]);

    // Main report fetching effect - handles multiple trigger conditions
    useEffect(() => {
        // Condition 1: Transaction thread was created
        const transactionThreadCreated = !prevTransactionThreadReportID && transactionThreadReportID;
        
        // Condition 2: User was invited to room (specific case)
        const wasInvitedToRoom = 
            prevReportActions.length === 0 && 
            reportActions.length === 1 && 
            reportActions.at(0)?.actionName === CONST.REPORT.ACTIONS.TYPE.ROOM_CHANGE_LOG.INVITE_TO_ROOM;
        
        if (transactionThreadCreated || wasInvitedToRoom) {
            fetchReport();
        }
    }, [prevTransactionThreadReportID, transactionThreadReportID, prevReportActions, reportActions, fetchReport]);

    // Route-based report fetching - when route or linking state changes
    useEffect(() => {
        // This function is triggered when a user clicks on a link to navigate to a report.
        // For each link click, we retrieve the report data again, even though it may already be cached.
        // There should be only one openReport execution per page start or navigating
        fetchReport();
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, [route, isLinkedMessagePageReady, reportActionIDFromRoute]);

    // Re-open report when user returns to a thread they left
    useEffect(() => {
        if (!shouldUseNarrowLayout || !isFocused || prevIsFocused || !isChatThread(report) || !isHiddenForCurrentUser(report) || isTransactionThreadView) {
            return;
        }
        openReport(reportID);

        // We don't want to run this useEffect every time `report` is changed
        // Excluding shouldUseNarrowLayout from the dependency list to prevent re-triggering on screen resize events.
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, [prevIsFocused, report?.participants, isFocused, isTransactionThreadView, reportID]);

    // Handle route changes and compose input
    useEffect(() => {
        const onyxReportID = report?.reportID;
        const routeChanged = reportIDFromRoute !== lastReportIDFromRoute;
        const reportMismatch = onyxReportID && onyxReportID !== reportIDFromRoute;

        // Set compose input to visible when navigating between different reports
        if (routeChanged || reportMismatch) {
            setShouldShowComposeInput(true);
        }
    }, [report?.reportID, reportIDFromRoute, lastReportIDFromRoute]);

    // Initialize task report read time
    useEffect(() => {
        if (!!report?.lastReadTime || !isTaskReport(report)) {
            return;
        }
        // After creating the task report then navigating to task detail we don't have any report actions and the last read time is empty so We need to update the initial last read time when opening the task report detail.
        readNewestAction(report?.reportID);
    }, [report]);

    return {
        fetchReport,
    };
}

export default useReportFetching;
