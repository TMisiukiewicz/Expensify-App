import {useMemo} from 'react';
import type {OnyxCollection, OnyxEntry} from 'react-native-onyx';
import {accountIDSelector} from '@selectors/Session';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {getAllNonDeletedTransactions} from '@libs/MoneyRequestReportUtils';
import {isDeletedParentAction} from '@libs/ReportActionsUtils';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import {getEmptyObject} from '@src/types/utils/EmptyObject';
import useOnyx from './useOnyx';
import useParentReportAction from './useParentReportAction';
import useTransactionsAndViolationsForReport from './useTransactionsAndViolationsForReport';

const defaultReportMetadata = {
    hasOnceLoadedReportActions: false,
    isLoadingInitialReportActions: true,
    isLoadingOlderReportActions: false,
    hasLoadingOlderReportActionsError: false,
    isLoadingNewerReportActions: false,
    hasLoadingNewerReportActionsError: false,
    isOptimisticReport: false,
};

type UseReportDataReturn = {
    // Core report data
    report: OnyxEntry<OnyxTypes.Report>;
    reportID: string | undefined;
    reportMetadata: NonNullable<OnyxEntry<OnyxTypes.ReportMetadata>>;
    
    // Related reports
    chatReport: OnyxEntry<OnyxTypes.Report>;
    accountManagerReport: OnyxEntry<OnyxTypes.Report>;
    
    // User and session data
    currentUserAccountID: number;
    personalDetails: OnyxEntry<OnyxTypes.PersonalDetailsList>;
    
    // Parent report data
    parentReportAction: OnyxEntry<OnyxTypes.ReportAction>;
    deletedParentAction: boolean;
    
    // Policy data
    policy: OnyxEntry<OnyxTypes.Policy>;
    
    // Transactions data
    allReportTransactions: Record<string, OnyxTypes.Transaction>;
    allReportViolations: Record<string, OnyxTypes.TransactionViolation[]>;
    reportTransactions: OnyxTypes.Transaction[];
    visibleTransactions: OnyxTypes.Transaction[];
    
    // App state
    isComposerFullSize: boolean;
    userLeavingStatus: boolean;
    isLoadingReportData: boolean;
    isLoadingApp: boolean | undefined;
    
    // Account manager
    accountManagerReportID: string | undefined;
};

function useReportData(reportIDFromRoute: string | undefined, isOffline: boolean): UseReportDataReturn {
    // Core report data
    const [report] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${reportIDFromRoute}`, {allowStaleData: true, canBeMissing: true});
    const [reportMetadata = defaultReportMetadata] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_METADATA}${reportIDFromRoute}`, {canBeMissing: true, allowStaleData: true});
    
    // User and session data
    const [currentUserAccountID = -1] = useOnyx(ONYXKEYS.SESSION, {selector: accountIDSelector, canBeMissing: false});
    const [personalDetails] = useOnyx(ONYXKEYS.PERSONAL_DETAILS_LIST, {canBeMissing: true});
    
    // App state
    const [isLoadingReportData = true] = useOnyx(ONYXKEYS.IS_LOADING_REPORT_DATA, {canBeMissing: true});
    const [isLoadingApp] = useOnyx(ONYXKEYS.IS_LOADING_APP, {canBeMissing: true});
    
    // UI state
    const [isComposerFullSize = false] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_IS_COMPOSER_FULL_SIZE}${reportIDFromRoute}`, {canBeMissing: true});
    const [userLeavingStatus = false] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_USER_IS_LEAVING_ROOM}${reportIDFromRoute}`, {canBeMissing: true});
    
    // Account manager
    const [accountManagerReportID] = useOnyx(ONYXKEYS.ACCOUNT_MANAGER_REPORT_ID, {canBeMissing: true});
    const [accountManagerReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getNonEmptyStringOnyxID(accountManagerReportID)}`, {canBeMissing: true});
    
    // Policies
    const [policies = getEmptyObject<NonNullable<OnyxCollection<OnyxTypes.Policy>>>()] = useOnyx(ONYXKEYS.COLLECTION.POLICY, {allowStaleData: true, canBeMissing: false});
    
    const reportID = report?.reportID;
    
    // Related reports
    const [chatReport] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT}${report?.chatReportID}`, {canBeMissing: true});
    
    // Parent report data
    const parentReportAction = useParentReportAction(report);
    const deletedParentAction = isDeletedParentAction(parentReportAction);
    
    // Policy data
    const policy = policies?.[`${ONYXKEYS.COLLECTION.POLICY}${report?.policyID}`];
    
    // Transactions and violations
    const {transactions: allReportTransactions, violations: allReportViolations} = useTransactionsAndViolationsForReport(reportIDFromRoute);
    
    // Process transactions
    const reportTransactions = useMemo(() => getAllNonDeletedTransactions(allReportTransactions, []), [allReportTransactions]);
    
    const visibleTransactions = useMemo(
        () => reportTransactions?.filter((transaction) => isOffline || transaction.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE),
        [reportTransactions, isOffline],
    );
    
    return {
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
        allReportTransactions,
        allReportViolations,
        reportTransactions,
        visibleTransactions,
        isComposerFullSize,
        userLeavingStatus,
        isLoadingReportData,
        isLoadingApp,
        accountManagerReportID,
    };
}

export default useReportData;