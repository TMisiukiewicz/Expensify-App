import {PortalHost} from '@gorhom/portal';
import {useIsFocused} from '@react-navigation/native';
import {deepEqual} from 'fast-equals';
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {FlatList, ViewStyle} from 'react-native';
import {DeviceEventEmitter, InteractionManager, View} from 'react-native';
import Banner from '@components/Banner';
import FullPageNotFoundView from '@components/BlockingViews/FullPageNotFoundView';
import DragAndDropProvider from '@components/DragAndDrop/Provider';
import * as Expensicons from '@components/Icon/Expensicons';
import MoneyReportHeader from '@components/MoneyReportHeader';
import MoneyRequestHeader from '@components/MoneyRequestHeader';
import MoneyRequestReportActionsList from '@components/MoneyRequestReportView/MoneyRequestReportActionsList';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import ReportActionsSkeletonView from '@components/ReportActionsSkeletonView';
import ScreenWrapper from '@components/ScreenWrapper';
import useAppFocusEvent from '@hooks/useAppFocusEvent';
import useCurrentReportID from '@hooks/useCurrentReportID';
import useIsAnonymousUser from '@hooks/useIsAnonymousUser';
import useIsReportReadyToDisplay from '@hooks/useIsReportReadyToDisplay';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useNewTransactions from '@hooks/useNewTransactions';
import useOnyx from '@hooks/useOnyx';
import usePaginatedReportActions from '@hooks/usePaginatedReportActions';
import usePrevious from '@hooks/usePrevious';
import useReportData from '@hooks/useReportData';
import useReportIsArchived from '@hooks/useReportIsArchived';
import useReportNavigation from '@hooks/useReportNavigation';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import useViewportOffsetTop from '@hooks/useViewportOffsetTop';
import {hideEmojiPicker} from '@libs/actions/EmojiPickerAction';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {shouldDisplayReportTableView, shouldWaitForTransactions as shouldWaitForTransactionsUtil} from '@libs/MoneyRequestReportUtils';
import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import clearReportNotifications from '@libs/Notification/clearReportNotifications';
import {getPersonalDetailsForAccountIDs} from '@libs/OptionsListUtils';
import {getDisplayNameOrDefault} from '@libs/PersonalDetailsUtils';
import {
    getCombinedReportActions,
    getFilteredReportActionsForReportView,
    getIOUActionForReportID,
    getOneTransactionThreadReportID,
    isCreatedAction,
    isMoneyRequestAction,
    isSentMoneyReportAction,
} from '@libs/ReportActionsUtils';
import {
    canEditReportAction,
    getParticipantsAccountIDsForDisplay,
    getReportOfflinePendingActionAndErrors,
    getReportTransactions,
    isChatThread,
    isConciergeChatReport,
    isHiddenForCurrentUser,
    isInvoiceReport,
    isMoneyRequestReport,
    isOneTransactionThread,
    isPolicyExpenseChat,
    isReportTransactionThread,
    isTaskReport,
    isValidReportIDFromPath,
} from '@libs/ReportUtils';
import type {ReportsSplitNavigatorParamList} from '@navigation/types';
import {setShouldShowComposeInput} from '@userActions/Composer';
import {
    clearDeleteTransactionNavigateBackUrl,
    createTransactionThreadReport,
    openReport,
    readNewestAction,
    subscribeToReportLeavingEvents,
    unsubscribeFromLeavingRoomReportChannel,
    updateLastVisitTime,
} from '@userActions/Report';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type * as OnyxTypes from '@src/types/onyx';
import {getEmptyObject} from '@src/types/utils/EmptyObject';
import getEmptyArray from '@src/types/utils/getEmptyArray';
import HeaderView from './HeaderView';
import ReactionListWrapper from './ReactionListWrapper';
import ReportActionsView from './report/ReportActionsView';
import ReportFooter from './report/ReportFooter';
import type {ActionListContextType, ScrollPosition} from './ReportScreenContext';
import {ActionListContext} from './ReportScreenContext';

type ReportScreenNavigationProps = PlatformStackScreenProps<ReportsSplitNavigatorParamList, typeof SCREENS.REPORT>;

type ReportScreenProps = ReportScreenNavigationProps;

function ReportScreen({route, navigation}: ReportScreenProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const reportIDFromRoute = getNonEmptyStringOnyxID(route.params?.reportID);
    const reportActionIDFromRoute = route?.params?.reportActionID;
    const isFocused = useIsFocused();
    const prevIsFocused = usePrevious(isFocused);
    const firstRenderRef = useRef(true);
    const isSkippingOpenReport = useRef(false);
    const flatListRef = useRef<FlatList>(null);
    const {isOffline} = useNetwork();
    const {shouldUseNarrowLayout, isInNarrowPaneModal} = useResponsiveLayout();
    const currentReportIDValue = useCurrentReportID();

    // Custom hook to consolidate all report data fetching
    const reportData = useReportData(reportIDFromRoute, isOffline);
    const {
        report,
        reportID,
        reportMetadata,
        chatReport,
        accountManagerReport,
        currentUserAccountID,
        personalDetails,
        parentReportAction,
        deletedParentAction,
        policy,
        allReportViolations,
        reportTransactions,
        visibleTransactions,
        isComposerFullSize,
        userLeavingStatus,
        isLoadingReportData,
        isLoadingApp,
        accountManagerReportID,
    } = reportData;

    const isAnonymousUser = useIsAnonymousUser();
    const prevDeletedParentAction = usePrevious(deletedParentAction);
    const prevIsLoadingReportData = usePrevious(isLoadingReportData);
    const prevIsAnonymousUser = useRef(false);
    const prevReport = usePrevious(report);
    const prevUserLeavingStatus = usePrevious(userLeavingStatus);
    const isTopMostReportId = currentReportIDValue?.currentReportID === reportIDFromRoute;

    const lastReportIDFromRoute = usePrevious(reportIDFromRoute);
    const [isLinkingToMessage, setIsLinkingToMessage] = useState(!!reportActionIDFromRoute);
    const {reportActions: unfilteredReportActions, linkedAction, sortedAllReportActions, hasNewerActions, hasOlderActions} = usePaginatedReportActions(reportID, reportActionIDFromRoute);
    // wrapping in useMemo because this is array operation and can cause performance issues
    const reportActions = useMemo(() => getFilteredReportActionsForReportView(unfilteredReportActions), [unfilteredReportActions]);
    const [childReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${linkedAction?.childReportID}`, {canBeMissing: true});

    const [isBannerVisible, setIsBannerVisible] = useState(true);
    const [scrollPosition, setScrollPosition] = useState<ScrollPosition>({});

    const viewportOffsetTop = useViewportOffsetTop();

    const {reportPendingAction, reportErrors} = getReportOfflinePendingActionAndErrors(report);
    const screenWrapperStyle: ViewStyle[] = [styles.appContent, styles.flex1, {marginTop: viewportOffsetTop}];
    const isOptimisticDelete = report?.statusNum === CONST.REPORT.STATUS_NUM.CLOSED;
    const isReportArchived = useReportIsArchived(report?.reportID);

    // Custom hook to handle all navigation logic
    const {shouldShowNotFoundPage, onBackButtonPress} = useReportNavigation({
        reportIDFromRoute,
        reportActionIDFromRoute,
        report,
        prevReport,
        userLeavingStatus,
        prevUserLeavingStatus,
        deletedParentAction,
        prevDeletedParentAction,
        isTopMostReportId,
        reportID,
        reportMetadata,
        isLoadingApp,
        isOptimisticDelete,
        linkedAction,
        sortedAllReportActions: sortedAllReportActions ?? getEmptyArray(),
        reportActions,
        isLinkingToMessage,
        currentUserAccountID,
        isReportArchived,
        firstRenderRef,
        route,
        navigation,
    });

    const chatWithAccountManagerText = useMemo(() => {
        if (accountManagerReportID) {
            const participants = getParticipantsAccountIDsForDisplay(accountManagerReport, false, true);
            const participantPersonalDetails = getPersonalDetailsForAccountIDs([participants?.at(0) ?? -1], personalDetails);
            const participantPersonalDetail = Object.values(participantPersonalDetails).at(0);
            const displayName = getDisplayNameOrDefault(participantPersonalDetail);
            const login = participantPersonalDetail?.login;
            if (displayName && login) {
                return translate('common.chatWithAccountManager', {accountManagerDisplayName: `${displayName} (${login})`});
            }
        }
        return '';
    }, [accountManagerReportID, accountManagerReport, personalDetails, translate]);

    const indexOfLinkedMessage = useMemo(
        (): number => reportActions.findIndex((obj) => reportActionIDFromRoute && String(obj.reportActionID) === String(reportActionIDFromRoute)),
        [reportActions, reportActionIDFromRoute],
    );

    const doesCreatedActionExists = useCallback(() => !!reportActions?.findLast((action) => isCreatedAction(action)), [reportActions]);
    const isLinkedMessageAvailable = indexOfLinkedMessage > -1;

    // The linked report actions should have at least 15 messages (counting as 1 page) above them to fill the screen.
    // If the count is too high (equal to or exceeds the web pagination size / 50) and there are no cached messages in the report,
    // OpenReport will be called each time the user scrolls up the report a bit, clicks on report preview, and then goes back.
    const isLinkedMessagePageReady = isLinkedMessageAvailable && (reportActions.length - indexOfLinkedMessage >= CONST.REPORT.MIN_INITIAL_REPORT_ACTION_COUNT || doesCreatedActionExists());
    const reportTransactionIDs = useMemo(() => visibleTransactions?.map((transaction) => transaction.transactionID), [visibleTransactions]);

    const transactionThreadReportID = getOneTransactionThreadReportID(report, chatReport, reportActions ?? [], isOffline, reportTransactionIDs);
    const [transactionThreadReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${transactionThreadReportID}`, {canBeMissing: true});
    const [transactionThreadReportActions = getEmptyObject<OnyxTypes.ReportActions>()] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${transactionThreadReportID}`, {
        canBeMissing: true,
    });
    const combinedReportActions = getCombinedReportActions(reportActions, transactionThreadReportID ?? null, Object.values(transactionThreadReportActions));
    const isSentMoneyReport = useMemo(() => reportActions.some((action) => isSentMoneyReportAction(action)), [reportActions]);
    const lastReportAction = [...combinedReportActions, parentReportAction].find((action) => canEditReportAction(action) && !isMoneyRequestAction(action));
    const didSubscribeToReportLeavingEvents = useRef(false);
    const isTransactionThreadView = isReportTransactionThread(report);
    const isMoneyRequestOrInvoiceReport = isMoneyRequestReport(report) || isInvoiceReport(report);
    // Prevent the empty state flash by ensuring transaction data is fully loaded before deciding which view to render
    // We need to wait for both the selector to finish AND ensure we're not in a loading state where transactions could still populate
    const shouldWaitForTransactions = shouldWaitForTransactionsUtil(report, reportTransactions, reportMetadata);

    const newTransactions = useNewTransactions(reportMetadata?.hasOnceLoadedReportActions, reportTransactions);

    useEffect(() => {
        if (!prevIsFocused || isFocused) {
            return;
        }
        hideEmojiPicker(true);
    }, [prevIsFocused, isFocused]);

    let headerView = (
        <HeaderView
            reportID={reportIDFromRoute}
            onNavigationMenuButtonClicked={onBackButtonPress}
            report={report}
            parentReportAction={parentReportAction}
            shouldUseNarrowLayout={shouldUseNarrowLayout}
        />
    );

    if (isTransactionThreadView) {
        headerView = (
            <MoneyRequestHeader
                report={report}
                policy={policy}
                parentReportAction={parentReportAction}
                onBackButtonPress={onBackButtonPress}
            />
        );
    }

    if (isMoneyRequestOrInvoiceReport) {
        headerView = (
            <MoneyReportHeader
                report={report}
                policy={policy}
                transactionThreadReportID={transactionThreadReportID}
                isLoadingInitialReportActions={reportMetadata.isLoadingInitialReportActions}
                reportActions={reportActions}
                onBackButtonPress={onBackButtonPress}
            />
        );
    }

    useEffect(() => {
        if (!transactionThreadReportID || !route?.params?.reportActionID || !isOneTransactionThread(childReport, report, linkedAction)) {
            return;
        }
        navigation.setParams({reportActionID: ''});
    }, [transactionThreadReportID, route?.params?.reportActionID, linkedAction, reportID, navigation, report, childReport]);

    const {isEditingDisabled, isCurrentReportLoadedFromOnyx} = useIsReportReadyToDisplay(report, reportIDFromRoute, isReportArchived);

    // eslint-disable-next-line react-compiler/react-compiler
    const lastReportActionIDFromRoute = usePrevious(!firstRenderRef.current ? reportActionIDFromRoute : undefined);
    const [deleteTransactionNavigateBackUrl] = useOnyx(ONYXKEYS.NVP_DELETE_TRANSACTION_NAVIGATE_BACK_URL, {canBeMissing: true});

    useEffect(() => {
        if (!isFocused || !deleteTransactionNavigateBackUrl) {
            return;
        }
        // Clear the URL after all interactions are processed to ensure all updates are completed before hiding the skeleton
        InteractionManager.runAfterInteractions(() => {
            requestAnimationFrame(() => {
                clearDeleteTransactionNavigateBackUrl();
            });
        });
    }, [isFocused, deleteTransactionNavigateBackUrl]);

    const createOneTransactionThreadReport = useCallback(() => {
        const currentReportTransaction = getReportTransactions(reportID).filter((transaction) => transaction.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE);
        const oneTransactionID = currentReportTransaction.at(0)?.transactionID;
        const iouAction = getIOUActionForReportID(reportID, oneTransactionID);
        createTransactionThreadReport(report, iouAction);
    }, [report, reportID]);

    const fetchReport = useCallback(() => {
        if (reportMetadata.isOptimisticReport && report?.type === CONST.REPORT.TYPE.CHAT && !isPolicyExpenseChat(report)) {
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
        reportMetadata.isOptimisticReport,
        report,
        isOffline,
        transactionThreadReportID,
        transactionThreadReport,
        reportIDFromRoute,
        reportActionIDFromRoute,
        createOneTransactionThreadReport,
    ]);

    useEffect(() => {
        if (!isAnonymousUser) {
            return;
        }
        prevIsAnonymousUser.current = true;
    }, [isAnonymousUser]);

    useEffect(() => {
        if (isLoadingReportData || !prevIsLoadingReportData || !prevIsAnonymousUser.current || isAnonymousUser) {
            return;
        }
        // Re-fetch public report data after user signs in and OpenApp API is called to
        // avoid reportActions data being empty for public rooms.
        fetchReport();
    }, [isLoadingReportData, prevIsLoadingReportData, prevIsAnonymousUser, isAnonymousUser, fetchReport]);

    const prevTransactionThreadReportID = usePrevious(transactionThreadReportID);
    useEffect(() => {
        if (!!prevTransactionThreadReportID || !transactionThreadReportID) {
            return;
        }

        fetchReport();
    }, [fetchReport, prevTransactionThreadReportID, transactionThreadReportID]);

    useEffect(() => {
        if (!reportID || !isFocused) {
            return;
        }
        updateLastVisitTime(reportID);
    }, [reportID, isFocused]);

    useEffect(() => {
        const skipOpenReportListener = DeviceEventEmitter.addListener(`switchToPreExistingReport_${reportID}`, ({preexistingReportID}: {preexistingReportID: string}) => {
            if (!preexistingReportID) {
                return;
            }
            isSkippingOpenReport.current = true;
        });

        return () => {
            skipOpenReportListener.remove();
        };
    }, [reportID]);

    const dismissBanner = useCallback(() => {
        setIsBannerVisible(false);
    }, []);

    const chatWithAccountManager = useCallback(() => {
        Navigation.navigate(ROUTES.REPORT_WITH_ID.getRoute(accountManagerReportID));
    }, [accountManagerReportID]);

    // Clear notifications for the current report when it's opened and re-focused
    const clearNotifications = useCallback(() => {
        // Check if this is the top-most ReportScreen since the Navigator preserves multiple at a time
        if (!isTopMostReportId) {
            return;
        }

        clearReportNotifications(reportID);
    }, [reportID, isTopMostReportId]);

    useEffect(clearNotifications, [clearNotifications]);
    useAppFocusEvent(clearNotifications);

    useEffect(() => {
        const interactionTask = InteractionManager.runAfterInteractions(() => {
            setShouldShowComposeInput(true);
        });
        return () => {
            interactionTask.cancel();
            if (!didSubscribeToReportLeavingEvents.current) {
                return;
            }

            unsubscribeFromLeavingRoomReportChannel(reportID);
        };

        // I'm disabling the warning, as it expects to use exhaustive deps, even though we want this useEffect to run only on the first render.
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        // This function is triggered when a user clicks on a link to navigate to a report.
        // For each link click, we retrieve the report data again, even though it may already be cached.
        // There should be only one openReport execution per page start or navigating
        fetchReport();
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, [route, isLinkedMessagePageReady, reportActionIDFromRoute]);

    const prevReportActions = usePrevious(reportActions);
    useEffect(() => {
        // This function is only triggered when a user is invited to a room after opening the link.
        // When a user opens a room they are not a member of, and the admin then invites them, only the INVITE_TO_ROOM action is available, so the background will be empty and room description is not available.
        // See https://github.com/Expensify/App/issues/57769 for more details
        if (prevReportActions.length !== 0 || reportActions.length !== 1 || reportActions.at(0)?.actionName !== CONST.REPORT.ACTIONS.TYPE.ROOM_CHANGE_LOG.INVITE_TO_ROOM) {
            return;
        }
        fetchReport();
    }, [prevReportActions, reportActions, fetchReport]);

    // If a user has chosen to leave a thread, and then returns to it (e.g. with the back button), we need to call `openReport` again in order to allow the user to rejoin and to receive real-time updates
    useEffect(() => {
        if (!shouldUseNarrowLayout || !isFocused || prevIsFocused || !isChatThread(report) || !isHiddenForCurrentUser(report) || isTransactionThreadView) {
            return;
        }
        openReport(reportID);

        // We don't want to run this useEffect every time `report` is changed
        // Excluding shouldUseNarrowLayout from the dependency list to prevent re-triggering on screen resize events.
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, [prevIsFocused, report?.participants, isFocused, isTransactionThreadView, reportID]);

    useEffect(() => {
        // We don't want this effect to run on the first render.
        if (firstRenderRef.current) {
            firstRenderRef.current = false;
            return;
        }

        const onyxReportID = report?.reportID;

        // If you already have a report open and are deeplinking to a new report on native,
        // the ReportScreen never actually unmounts and the reportID in the route also doesn't change.
        // Therefore, we need to compare if the existing reportID is the same as the one in the route
        // before deciding that we shouldn't call OpenReport.
        if (reportIDFromRoute === lastReportIDFromRoute && (!onyxReportID || onyxReportID === reportIDFromRoute)) {
            return;
        }

        setShouldShowComposeInput(true);
        // eslint-disable-next-line react-compiler/react-compiler, react-hooks/exhaustive-deps
    }, [route, report, reportIDFromRoute, lastReportIDFromRoute]);

    useEffect(() => {
        if (!isValidReportIDFromPath(reportIDFromRoute)) {
            return;
        }
        // Ensures the optimistic report is created successfully
        if (reportIDFromRoute !== report?.reportID || report?.pendingFields?.createChat) {
            return;
        }
        // Ensures subscription event succeeds when the report/workspace room is created optimistically.
        // Check if the optimistic `OpenReport` or `AddWorkspaceRoom` has succeeded by confirming
        // any `pendingFields.createChat` or `pendingFields.addWorkspaceRoom` fields are set to null.
        // Existing reports created will have empty fields for `pendingFields`.
        const didCreateReportSuccessfully = !report?.pendingFields || (!report?.pendingFields.addWorkspaceRoom && !report?.pendingFields.createChat);
        let interactionTask: ReturnType<typeof InteractionManager.runAfterInteractions> | null = null;
        if (!didSubscribeToReportLeavingEvents.current && didCreateReportSuccessfully) {
            interactionTask = InteractionManager.runAfterInteractions(() => {
                subscribeToReportLeavingEvents(reportIDFromRoute);
                didSubscribeToReportLeavingEvents.current = true;
            });
        }
        return () => {
            if (!interactionTask) {
                return;
            }
            interactionTask.cancel();
        };
    }, [report, didSubscribeToReportLeavingEvents, reportIDFromRoute]);

    const actionListValue = useMemo((): ActionListContextType => ({flatListRef, scrollPosition, setScrollPosition}), [flatListRef, scrollPosition, setScrollPosition]);

    // This helps in tracking from the moment 'route' triggers useMemo until isLoadingInitialReportActions becomes true. It prevents blinking when loading reportActions from cache.
    useEffect(() => {
        InteractionManager.runAfterInteractions(() => {
            setIsLinkingToMessage(false);
        });
    }, [reportMetadata?.isLoadingInitialReportActions]);

    useEffect(() => {
        if (!!report?.lastReadTime || !isTaskReport(report)) {
            return;
        }
        // After creating the task report then navigating to task detail we don't have any report actions and the last read time is empty so We need to update the initial last read time when opening the task report detail.
        readNewestAction(report?.reportID);
    }, [report]);

    const lastRoute = usePrevious(route);

    // wrapping into useMemo to stabilize children re-renders as reportMetadata is changed frequently
    const showReportActionsLoadingState = useMemo(
        () => reportMetadata?.isLoadingInitialReportActions && !reportMetadata?.hasOnceLoadedReportActions,
        [reportMetadata?.isLoadingInitialReportActions, reportMetadata?.hasOnceLoadedReportActions],
    );

    // Define here because reportActions are recalculated before mount, allowing data to display faster than useEffect can trigger.
    // If we have cached reportActions, they will be shown immediately.
    // We aim to display a loader first, then fetch relevant reportActions, and finally show them.
    if ((lastRoute !== route || lastReportActionIDFromRoute !== reportActionIDFromRoute) && isLinkingToMessage !== !!reportActionIDFromRoute) {
        setIsLinkingToMessage(!!reportActionIDFromRoute);
        return null;
    }

    // If true reports that are considered MoneyRequest | InvoiceReport will get the new report table view
    const shouldDisplayMoneyRequestActionsList = isMoneyRequestOrInvoiceReport && shouldDisplayReportTableView(report, visibleTransactions ?? []);

    return (
        <ActionListContext.Provider value={actionListValue}>
            <ReactionListWrapper>
                <ScreenWrapper
                    navigation={navigation}
                    style={screenWrapperStyle}
                    shouldEnableKeyboardAvoidingView={isTopMostReportId || isInNarrowPaneModal}
                    testID={`report-screen-${reportID}`}
                >
                    <FullPageNotFoundView
                        shouldShow={shouldShowNotFoundPage}
                        subtitleKey="notFound.noAccess"
                        subtitleStyle={[styles.textSupporting]}
                        shouldShowBackButton={shouldUseNarrowLayout}
                        onBackButtonPress={Navigation.goBack}
                        shouldDisplaySearchRouter
                    >
                        <OfflineWithFeedback
                            pendingAction={reportPendingAction}
                            errors={reportErrors}
                            shouldShowErrorMessages={false}
                            needsOffscreenAlphaCompositing
                        >
                            {headerView}
                        </OfflineWithFeedback>
                        {!!accountManagerReportID && isConciergeChatReport(report) && isBannerVisible && (
                            <Banner
                                containerStyles={[styles.mh4, styles.mt4, styles.p4, styles.br2]}
                                text={chatWithAccountManagerText}
                                onClose={dismissBanner}
                                onButtonPress={chatWithAccountManager}
                                shouldShowCloseButton
                                icon={Expensicons.Lightbulb}
                                shouldShowIcon
                                shouldShowButton
                            />
                        )}
                        <DragAndDropProvider isDisabled={isEditingDisabled}>
                            <View
                                style={[styles.flex1, styles.justifyContentEnd, styles.overflowHidden]}
                                testID="report-actions-view-wrapper"
                            >
                                {(!report || shouldWaitForTransactions) && <ReportActionsSkeletonView />}
                                {!!report && !shouldDisplayMoneyRequestActionsList && !shouldWaitForTransactions ? (
                                    <ReportActionsView
                                        report={report}
                                        reportActions={reportActions}
                                        isLoadingInitialReportActions={reportMetadata?.isLoadingInitialReportActions}
                                        hasNewerActions={hasNewerActions}
                                        hasOlderActions={hasOlderActions}
                                        parentReportAction={parentReportAction}
                                        transactionThreadReportID={transactionThreadReportID}
                                    />
                                ) : null}
                                {!!report && shouldDisplayMoneyRequestActionsList && !shouldWaitForTransactions ? (
                                    <MoneyRequestReportActionsList
                                        report={report}
                                        policy={policy}
                                        reportActions={reportActions}
                                        transactions={visibleTransactions}
                                        newTransactions={newTransactions}
                                        violations={allReportViolations}
                                        hasOlderActions={hasOlderActions}
                                        hasNewerActions={hasNewerActions}
                                        showReportActionsLoadingState={showReportActionsLoadingState}
                                    />
                                ) : null}
                                {isCurrentReportLoadedFromOnyx ? (
                                    <ReportFooter
                                        report={report}
                                        reportMetadata={reportMetadata}
                                        policy={policy}
                                        pendingAction={reportPendingAction}
                                        isComposerFullSize={!!isComposerFullSize}
                                        lastReportAction={lastReportAction}
                                        reportTransactions={reportTransactions}
                                        // If the report is from the 'Send Money' flow, we add the comment to the `iou` report because for these we don't combine reportActions even if there is a single transaction (they always have a single transaction)
                                        transactionThreadReportID={isSentMoneyReport ? undefined : transactionThreadReportID}
                                    />
                                ) : null}
                            </View>
                            <PortalHost name="suggestions" />
                        </DragAndDropProvider>
                    </FullPageNotFoundView>
                </ScreenWrapper>
            </ReactionListWrapper>
        </ActionListContext.Provider>
    );
}

ReportScreen.displayName = 'ReportScreen';
export default memo(ReportScreen, (prevProps, nextProps) => deepEqual(prevProps.route, nextProps.route));
