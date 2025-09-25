import {useIsFocused} from '@react-navigation/native';
import type {NavigationProp, RouteProp} from '@react-navigation/native';
import {useCallback, useEffect, useMemo, useState} from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import Log from '@libs/Log';
import Navigation, {navigationRef} from '@libs/Navigation/Navigation';
import {getFilteredReportActionsForReportView, isWhisperAction, shouldReportActionBeVisible} from '@libs/ReportActionsUtils';
import {
    canUserPerformWriteAction,
    findLastAccessedReport,
    isGroupChat,
    isMoneyRequest,
    isMoneyRequestReport,
    isMoneyRequestReportPendingDeletion,
    isPolicyExpenseChat,
    isValidReportIDFromPath,
} from '@libs/ReportUtils';
import {isNumeric} from '@libs/ValidationUtils';
import type {ReportsSplitNavigatorParamList} from '@navigation/types';
import {navigateToConciergeChat} from '@userActions/Report';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type {Route} from '@src/ROUTES';
import SCREENS from '@src/SCREENS';
import type * as OnyxTypes from '@src/types/onyx';
import {isEmptyObject} from '@src/types/utils/EmptyObject';
import useCurrentReportID from './useCurrentReportID';
import useCurrentUserPersonalDetails from './useCurrentUserPersonalDetails';
import useOnyx from './useOnyx';
import usePaginatedReportActions from './usePaginatedReportActions';
import usePermissions from './usePermissions';
import usePrevious from './usePrevious';
import useReportIsArchived from './useReportIsArchived';
import useResponsiveLayout from './useResponsiveLayout';

const reportDetailScreens = [
    ...Object.values(SCREENS.REPORT_DETAILS),
    ...Object.values(SCREENS.REPORT_SETTINGS),
    ...Object.values(SCREENS.PRIVATE_NOTES),
    ...Object.values(SCREENS.REPORT_PARTICIPANTS),
];

// Check if the report is deleted
function isEmpty(report: OnyxEntry<OnyxTypes.Report>): boolean {
    if (isEmptyObject(report)) {
        return true;
    }
    return !Object.values(report as Record<string, unknown>).some((value) => value !== undefined && value !== '');
}

type ReportScreenRoute = RouteProp<ReportsSplitNavigatorParamList, typeof SCREENS.REPORT>;
type ReportScreenNavigation = NavigationProp<ReportsSplitNavigatorParamList, typeof SCREENS.REPORT>;

type UseReportNavigationProps = {
    reportIDFromRoute: string | undefined;
    reportActionIDFromRoute: string | undefined;
    isLinkingToMessage: boolean;
    route: ReportScreenRoute;
    navigation: ReportScreenNavigation;
};

type UseReportNavigationReturn = {
    shouldShowNotFoundPage: boolean;
    onBackButtonPress: (prioritizeBackTo?: boolean) => void;
    isNavigatingToDeletedAction: boolean;
    setIsNavigatingToDeletedAction: (value: boolean) => void;
    firstRender: boolean;
    setFirstRender: (value: boolean) => void;
};

function useReportNavigation({reportIDFromRoute, reportActionIDFromRoute, isLinkingToMessage, route, navigation}: UseReportNavigationProps): UseReportNavigationReturn {
    const isFocused = useIsFocused();
    const {isBetaEnabled} = usePermissions();
    const {isInNarrowPaneModal} = useResponsiveLayout();
    const [wasReportAccessible, setWasReportAccessible] = useState(false);
    const [firstRender, setFirstRender] = useState(true);
    const [isNavigatingToDeletedAction, setIsNavigatingToDeletedAction] = useState(false);

    // Fetch data directly using Onyx hooks
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportIDFromRoute}`, {canBeMissing: true});
    const prevReport = usePrevious(report);
    const [reportMetadata] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_METADATA}${reportIDFromRoute}`, {canBeMissing: true});
    const [userLeavingStatus] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_USER_IS_LEAVING_ROOM}${reportIDFromRoute}`, {canBeMissing: true});
    const prevUserLeavingStatus = usePrevious(userLeavingStatus);
    const [isLoadingApp] = useOnyx(ONYXKEYS.IS_LOADING_APP);
    const currentUserPersonalDetails = useCurrentUserPersonalDetails();
    const currentUserAccountID = currentUserPersonalDetails?.accountID ?? -1;
    const isReportArchived = useReportIsArchived(report?.reportID);

    // Get report actions and linked action
    const {reportActions: unfilteredReportActions, linkedAction, sortedAllReportActions} = usePaginatedReportActions(report?.reportID, reportActionIDFromRoute);
    const reportActions = useMemo(() => getFilteredReportActionsForReportView(unfilteredReportActions), [unfilteredReportActions]);

    // Derived state
    const reportID = report?.reportID;
    const isOptimisticDelete = report?.statusNum === CONST.REPORT.STATUS_NUM.CLOSED;
    const deletedParentAction = !report?.parentReportActionID;
    const prevDeletedParentAction = usePrevious(deletedParentAction);

    // Get current report ID for comparison
    const currentReportIDValue = useCurrentReportID();
    const isTopMostReportId = currentReportIDValue?.currentReportID === reportIDFromRoute;

    // Set initial reportID from last accessed report if none provided
    useEffect(() => {
        // Don't update if there is a reportID in the params already
        if (route.params.reportID) {
            const reportActionID = route?.params?.reportActionID;
            const isValidReportActionID = reportActionID && isNumeric(reportActionID);
            if (reportActionID && !isValidReportActionID) {
                Navigation.isNavigationReady().then(() => navigation.setParams({reportActionID: ''}));
            }
            return;
        }

        const lastAccessedReportID = findLastAccessedReport(!isBetaEnabled(CONST.BETAS.DEFAULT_ROOMS), !!route.params.openOnAdminRoom)?.reportID;

        // It's possible that reports aren't fully loaded yet
        // in that case the reportID is undefined
        if (!lastAccessedReportID) {
            return;
        }

        Log.info(`[ReportScreen] no reportID found in params, setting it to lastAccessedReportID: ${lastAccessedReportID}`);
        navigation.setParams({reportID: lastAccessedReportID});
    }, [isBetaEnabled, navigation, route]);

    // Track report accessibility
    useEffect(() => {
        setWasReportAccessible(!!report?.reportID);
    }, [report?.reportID]);

    // Handle back button navigation logic
    const backTo = route?.params?.backTo as string;
    const onBackButtonPress = useCallback(
        (prioritizeBackTo = false) => {
            if (backTo === SCREENS.SEARCH.REPORT_RHP) {
                Navigation.goBack();
                return;
            }
            if (prioritizeBackTo && backTo) {
                Navigation.goBack(backTo as Route);
                return;
            }
            if (isInNarrowPaneModal) {
                Navigation.dismissModal();
                return;
            }
            if (backTo) {
                Navigation.goBack(backTo as Route);
                return;
            }
            if (Navigation.getShouldPopToSidebar()) {
                Navigation.popToSidebar();
                return;
            }
            Navigation.goBack();
        },
        [isInNarrowPaneModal, backTo],
    );

    // Check for linked action deletion/accessibility
    const isLinkedActionDeleted = useMemo(
        () => !!linkedAction && !shouldReportActionBeVisible(linkedAction, linkedAction.reportActionID, canUserPerformWriteAction(report, isReportArchived)),
        [linkedAction, report, isReportArchived],
    );

    const isLinkedActionInaccessibleWhisper = useMemo(
        () => !!linkedAction && isWhisperAction(linkedAction) && !(linkedAction?.whisperedToAccountIDs ?? []).includes(currentUserAccountID),
        [currentUserAccountID, linkedAction],
    );

    // eslint-disable-next-line rulesdir/no-negated-variables
    const shouldShowNotFoundLinkedAction =
        (!isLinkedActionInaccessibleWhisper && isLinkedActionDeleted && isNavigatingToDeletedAction) ||
        (!reportMetadata?.isLoadingInitialReportActions &&
            !!reportActionIDFromRoute &&
            !!sortedAllReportActions &&
            sortedAllReportActions?.length > 0 &&
            reportActions.length === 0 &&
            !isLinkingToMessage);

    // Determine when to show not found page
    // eslint-disable-next-line rulesdir/no-negated-variables
    const shouldShowNotFoundPage = useMemo((): boolean => {
        const currentReportIDFormRoute = route.params?.reportID;

        if (shouldShowNotFoundLinkedAction) {
            return true;
        }

        if (isLoadingApp !== false) {
            return false;
        }

        // Check if report was never accessible and other conditions
        if (!wasReportAccessible && !firstRender && !reportID && !isOptimisticDelete && !reportMetadata?.isLoadingInitialReportActions && !userLeavingStatus) {
            return true;
        }

        // Check if current route report ID is valid
        return !!currentReportIDFormRoute && !isValidReportIDFromPath(currentReportIDFormRoute);
    }, [
        route.params?.reportID,
        shouldShowNotFoundLinkedAction,
        isLoadingApp,
        firstRender,
        reportID,
        isOptimisticDelete,
        reportMetadata?.isLoadingInitialReportActions,
        userLeavingStatus,
        wasReportAccessible,
    ]);

    // Compute navigation conditions
    const navigationConditions = useMemo(() => {
        const onyxReportID = report?.reportID;
        const prevOnyxReportID = prevReport?.reportID;
        const wasReportRemoved = !!prevOnyxReportID && prevOnyxReportID === reportIDFromRoute && !onyxReportID;

        return {
            wasReportRemoved,
            isRemovalExpectedForReportType: isEmpty(report) && (isMoneyRequest(prevReport) || isMoneyRequestReport(prevReport) || isPolicyExpenseChat(prevReport) || isGroupChat(prevReport)),
            didReportClose: wasReportRemoved && prevReport?.statusNum === CONST.REPORT.STATUS_NUM.OPEN && report?.statusNum === CONST.REPORT.STATUS_NUM.CLOSED,
            isTopLevelPolicyRoomWithNoStatus: !report?.statusNum && !prevReport?.parentReportID && prevReport?.chatType === CONST.REPORT.CHAT_TYPE.POLICY_ROOM,
            isClosedTopLevelPolicyRoom: wasReportRemoved && prevReport?.statusNum === CONST.REPORT.STATUS_NUM.OPEN && (!report?.statusNum && !prevReport?.parentReportID && prevReport?.chatType === CONST.REPORT.CHAT_TYPE.POLICY_ROOM),
            userLeftRoom: !prevUserLeavingStatus && !!userLeavingStatus,
            parentActionRestored: prevDeletedParentAction && !deletedParentAction,
        };
    }, [report, prevReport, reportIDFromRoute, userLeavingStatus, prevUserLeavingStatus, deletedParentAction, prevDeletedParentAction]);

    // Handle report removal/closure navigation
    useEffect(() => {
        const {
            userLeftRoom,
            didReportClose,
            isRemovalExpectedForReportType,
            isClosedTopLevelPolicyRoom,
            parentActionRestored,
        } = navigationConditions;

        // Navigate to appropriate screen when report is removed/closed
        if (userLeftRoom || didReportClose || isRemovalExpectedForReportType || isClosedTopLevelPolicyRoom || parentActionRestored) {
            const currentRoute = navigationRef.getCurrentRoute();
            const isReportDetailOpenInRHP =
                isTopMostReportId &&
                reportDetailScreens.find((r) => r === currentRoute?.name) &&
                !!currentRoute?.params &&
                typeof currentRoute.params === 'object' &&
                'reportID' in currentRoute.params &&
                reportIDFromRoute === currentRoute.params.reportID;

            // Early return if not focused or in narrow pane modal
            if ((!isFocused && !isReportDetailOpenInRHP) || isInNarrowPaneModal) {
                return;
            }

            Navigation.dismissModal();

            const prevOnyxReportID = prevReport?.reportID;
            if (Navigation.getTopmostReportId() === prevOnyxReportID) {
                Navigation.isNavigationReady().then(() => {
                    Navigation.popToSidebar();
                });
            }

            // Navigate to parent report if exists
            if (prevReport?.parentReportID) {
                // Prevent navigation to the IOU/Expense Report if it is pending deletion.
                if (isMoneyRequestReportPendingDeletion(prevReport.parentReportID)) {
                    return;
                }
                Navigation.isNavigationReady().then(() => {
                    Navigation.navigate(ROUTES.REPORT_WITH_ID.getRoute(prevReport.parentReportID));
                });
                return;
            }

            // Default to concierge chat
            Navigation.isNavigationReady().then(() => {
                navigateToConciergeChat();
            });
        }
    }, [navigationConditions, isFocused, isTopMostReportId, isInNarrowPaneModal, reportIDFromRoute, prevReport]);

    return {
        shouldShowNotFoundPage,
        onBackButtonPress,
        isNavigatingToDeletedAction,
        setIsNavigatingToDeletedAction,
        firstRender,
        setFirstRender,
    };
}

export default useReportNavigation;
