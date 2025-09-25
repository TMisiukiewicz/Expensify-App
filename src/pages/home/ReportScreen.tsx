import {PortalHost} from '@gorhom/portal';
import {useIsFocused} from '@react-navigation/native';
import {deepEqual} from 'fast-equals';
import React, {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {FlatList, ViewStyle} from 'react-native';
import {InteractionManager, View} from 'react-native';
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
import useCurrentReportID from '@hooks/useCurrentReportID';
import useIsReportReadyToDisplay from '@hooks/useIsReportReadyToDisplay';
import useLocalize from '@hooks/useLocalize';
import useNetwork from '@hooks/useNetwork';
import useNewTransactions from '@hooks/useNewTransactions';
import useOnyx from '@hooks/useOnyx';
import usePaginatedReportActions from '@hooks/usePaginatedReportActions';
import usePrevious from '@hooks/usePrevious';
import useReportData from '@hooks/useReportData';
import useReportFetching from '@hooks/useReportFetching';
import useReportIsArchived from '@hooks/useReportIsArchived';
import useReportNavigation from '@hooks/useReportNavigation';
import useReportNotifications from '@hooks/useReportNotifications';
import useReportSubscriptions from '@hooks/useReportSubscriptions';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useThemeStyles from '@hooks/useThemeStyles';
import useViewportOffsetTop from '@hooks/useViewportOffsetTop';
import {hideEmojiPicker} from '@libs/actions/EmojiPickerAction';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {shouldDisplayReportTableView, shouldWaitForTransactions as shouldWaitForTransactionsUtil} from '@libs/MoneyRequestReportUtils';
import Navigation from '@libs/Navigation/Navigation';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import {getPersonalDetailsForAccountIDs} from '@libs/OptionsListUtils';
import {getDisplayNameOrDefault} from '@libs/PersonalDetailsUtils';
import {
    getCombinedReportActions,
    getFilteredReportActionsForReportView,
    getOneTransactionThreadReportID,
    isCreatedAction,
    isMoneyRequestAction,
    isSentMoneyReportAction,
} from '@libs/ReportActionsUtils';
import {
    canEditReportAction,
    getParticipantsAccountIDsForDisplay,
    getReportOfflinePendingActionAndErrors,
    isConciergeChatReport,
    isInvoiceReport,
    isMoneyRequestReport,
    isOneTransactionThread,
    isReportTransactionThread,
} from '@libs/ReportUtils';
import type {ReportsSplitNavigatorParamList} from '@navigation/types';
import {clearDeleteTransactionNavigateBackUrl} from '@userActions/Report';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import ROUTES from '@src/ROUTES';
import type SCREENS from '@src/SCREENS';
import type * as OnyxTypes from '@src/types/onyx';
import {getEmptyObject} from '@src/types/utils/EmptyObject';
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
        personalDetails,
        parentReportAction,
        policy,
        allReportViolations,
        reportTransactions,
        visibleTransactions,
        isComposerFullSize,
        accountManagerReportID,
    } = reportData;

    const isTopMostReportId = currentReportIDValue?.currentReportID === reportIDFromRoute;
    const [isLinkingToMessage, setIsLinkingToMessage] = useState(!!reportActionIDFromRoute);
    const {reportActions: unfilteredReportActions, linkedAction, hasNewerActions, hasOlderActions} = usePaginatedReportActions(reportID, reportActionIDFromRoute);
    // wrapping in useMemo because this is array operation and can cause performance issues
    const reportActions = useMemo(() => getFilteredReportActionsForReportView(unfilteredReportActions), [unfilteredReportActions]);
    const [childReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${linkedAction?.childReportID}`, {canBeMissing: true});

    const [isBannerVisible, setIsBannerVisible] = useState(true);
    const [scrollPosition, setScrollPosition] = useState<ScrollPosition>({});

    const viewportOffsetTop = useViewportOffsetTop();

    const {reportPendingAction, reportErrors} = getReportOfflinePendingActionAndErrors(report);
    const screenWrapperStyle: ViewStyle[] = [styles.appContent, styles.flex1, {marginTop: viewportOffsetTop}];
    const isReportArchived = useReportIsArchived(report?.reportID);

    // Custom hook to handle all navigation logic
    const {shouldShowNotFoundPage, onBackButtonPress, firstRender} = useReportNavigation({
        reportIDFromRoute,
        reportActionIDFromRoute,
        isLinkingToMessage,
        route,
        navigation,
    });

    const chatWithAccountManagerText = useMemo(() => {
        if (!accountManagerReportID) {
            return '';
        }
        
        const participants = getParticipantsAccountIDsForDisplay(accountManagerReport, false, true);
        const participantPersonalDetails = getPersonalDetailsForAccountIDs([participants?.at(0) ?? -1], personalDetails);
        const participantPersonalDetail = Object.values(participantPersonalDetails).at(0);
        const displayName = getDisplayNameOrDefault(participantPersonalDetail);
        const login = participantPersonalDetail?.login;
        
        if (displayName && login) {
            return translate('common.chatWithAccountManager', {accountManagerDisplayName: `${displayName} (${login})`});
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

    const transactionThreadReportID = useMemo(() => 
        getOneTransactionThreadReportID(report, chatReport, reportActions ?? [], isOffline, reportTransactionIDs),
        [report, chatReport, reportActions, isOffline, reportTransactionIDs]
    );
    const [transactionThreadReportActions = getEmptyObject<OnyxTypes.ReportActions>()] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${transactionThreadReportID}`, {
        canBeMissing: true,
    });
    const combinedReportActions = useMemo(() => 
        getCombinedReportActions(reportActions, transactionThreadReportID ?? null, Object.values(transactionThreadReportActions)),
        [reportActions, transactionThreadReportID, transactionThreadReportActions]
    );
    const isSentMoneyReport = useMemo(() => reportActions.some((action) => isSentMoneyReportAction(action)), [reportActions]);
    const lastReportAction = useMemo(() => 
        [...combinedReportActions, parentReportAction].find((action) => canEditReportAction(action) && !isMoneyRequestAction(action)),
        [combinedReportActions, parentReportAction]
    );
    const isTransactionThreadView = isReportTransactionThread(report);
    const isMoneyRequestOrInvoiceReport = isMoneyRequestReport(report) || isInvoiceReport(report);
    // Prevent the empty state flash by ensuring transaction data is fully loaded before deciding which view to render
    // We need to wait for both the selector to finish AND ensure we're not in a loading state where transactions could still populate
    const shouldWaitForTransactions = shouldWaitForTransactionsUtil(report, reportTransactions, reportMetadata);

    // If true reports that are considered MoneyRequest | InvoiceReport will get the new report table view
    const shouldDisplayMoneyRequestActionsList = useMemo(() => 
        isMoneyRequestOrInvoiceReport && shouldDisplayReportTableView(report, visibleTransactions ?? []),
        [isMoneyRequestOrInvoiceReport, report, visibleTransactions]
    );

    // Pass shouldDisplayMoneyRequestActionsList to hook for internal optimization
    const newTransactions = useNewTransactions(
        reportMetadata?.hasOnceLoadedReportActions, 
        reportTransactions, 
        shouldDisplayMoneyRequestActionsList
    );

    useReportFetching({
        reportIDFromRoute,
        reportActionIDFromRoute,
        transactionThreadReportID,
        reportActions,
        isLinkedMessagePageReady,
        route,
    });

    // Custom hook to handle notification clearing and user presence tracking
    useReportNotifications({
        reportID,
        isTopMostReportId,
    });

    // Custom hook to handle report subscriptions and event listeners
    useReportSubscriptions({
        report,
        reportIDFromRoute,
        reportID,
        reportMetadata,
        isSkippingOpenReport,
        setIsLinkingToMessage,
    });

    useEffect(() => {
        if (!prevIsFocused || isFocused) {
            return;
        }
        hideEmojiPicker(true);
    }, [prevIsFocused, isFocused]);

    const headerView = useMemo(() => {
        if (isMoneyRequestOrInvoiceReport) {
            return (
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

        if (isTransactionThreadView) {
            return (
                <MoneyRequestHeader
                    report={report}
                    policy={policy}
                    parentReportAction={parentReportAction}
                    onBackButtonPress={onBackButtonPress}
                />
            );
        }

        return (
            <HeaderView
                reportID={reportIDFromRoute}
                onNavigationMenuButtonClicked={onBackButtonPress}
                report={report}
                parentReportAction={parentReportAction}
                shouldUseNarrowLayout={shouldUseNarrowLayout}
            />
        );
    }, [
        isMoneyRequestOrInvoiceReport,
        isTransactionThreadView,
        report,
        policy,
        transactionThreadReportID,
        reportMetadata.isLoadingInitialReportActions,
        reportActions,
        onBackButtonPress,
        parentReportAction,
        reportIDFromRoute,
        shouldUseNarrowLayout,
    ]);

    useEffect(() => {
        if (!transactionThreadReportID || !route?.params?.reportActionID || !isOneTransactionThread(childReport, report, linkedAction)) {
            return;
        }
        navigation.setParams({reportActionID: ''});
    }, [transactionThreadReportID, route?.params?.reportActionID, linkedAction, reportID, navigation, report, childReport]);

    const {isEditingDisabled, isCurrentReportLoadedFromOnyx} = useIsReportReadyToDisplay(report, reportIDFromRoute, isReportArchived);

    // eslint-disable-next-line react-compiler/react-compiler
    const lastReportActionIDFromRoute = usePrevious(!firstRender ? reportActionIDFromRoute : undefined);
    const [deleteTransactionNavigateBackUrl] = useOnyx(ONYXKEYS.NVP_DELETE_TRANSACTION_NAVIGATE_BACK_URL, {canBeMissing: true});

    const clearDeleteTransactionUrl = useCallback(() => {
        InteractionManager.runAfterInteractions(() => {
            requestAnimationFrame(() => {
                clearDeleteTransactionNavigateBackUrl();
            });
        });
    }, []);

    useEffect(() => {
        if (!isFocused || !deleteTransactionNavigateBackUrl) {
            return;
        }
        // Clear the URL after all interactions are processed to ensure all updates are completed before hiding the skeleton
        clearDeleteTransactionUrl();
    }, [isFocused, deleteTransactionNavigateBackUrl, clearDeleteTransactionUrl]);

    const dismissBanner = useCallback(() => {
        setIsBannerVisible(false);
    }, []);

    const chatWithAccountManager = useCallback(() => {
        Navigation.navigate(ROUTES.REPORT_WITH_ID.getRoute(accountManagerReportID));
    }, [accountManagerReportID]);

    const actionListValue = useMemo((): ActionListContextType => ({flatListRef, scrollPosition, setScrollPosition}), [scrollPosition]);

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
