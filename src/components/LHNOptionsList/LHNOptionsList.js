import PropTypes from 'prop-types';
import React, {useCallback, useMemo} from 'react';
import {View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import {FlashList} from '@shopify/flash-list';
import _ from 'underscore';
import CONST from '../../CONST';
import ONYXKEYS from '../../ONYXKEYS';
import styles from '../../styles/styles';
import variables from '../../styles/variables';
import OptionRowLHNDataWithFocus from './OptionRowLHNDataWithFocus';
import reportActionPropTypes from '../../pages/home/report/reportActionPropTypes';
import reportPropTypes from '../../pages/reportPropTypes';
import * as UserUtils from '../../libs/UserUtils';
import participantPropTypes from '../participantPropTypes';
import * as OptionsListUtils from '../../libs/OptionsListUtils';

const propTypes = {
    /** Wrapper style for the section list */
    // eslint-disable-next-line react/forbid-prop-types
    style: PropTypes.arrayOf(PropTypes.object),

    /** Extra styles for the section list container */
    // eslint-disable-next-line react/forbid-prop-types
    contentContainerStyles: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.object), PropTypes.object]).isRequired,

    /** Sections for the section list */
    data: PropTypes.arrayOf(PropTypes.string).isRequired,

    /** Callback to fire when a row is selected */
    onSelectRow: PropTypes.func.isRequired,

    /** Toggle between compact and default view of the option */
    optionMode: PropTypes.oneOf(_.values(CONST.OPTION_MODE)).isRequired,

    /** Whether to allow option focus or not */
    shouldDisableFocusOptions: PropTypes.bool,

    /** The policy which the user has access to and which the report could be tied to */
    policy: PropTypes.shape({
        /** The ID of the policy */
        id: PropTypes.string,
        /** Name of the policy */
        name: PropTypes.string,
        /** Avatar of the policy */
        avatar: PropTypes.string,
    }),

    /** The actions from the parent report */
    parentReportActions: PropTypes.objectOf(PropTypes.shape(reportActionPropTypes)),

    /** All reports shared with the user */
    reports: PropTypes.objectOf(reportPropTypes),

    /** Array of report actions for this report */
    reportActions: PropTypes.arrayOf(PropTypes.shape(reportActionPropTypes)),

    /** Indicates which locale the user currently has selected */
    preferredLocale: PropTypes.string,

    /** List of users' personal details */
    personalDetails: PropTypes.objectOf(participantPropTypes),

    /** The transaction from the parent report action */
    transactions: PropTypes.arrayOf(
        PropTypes.shape({
            /** The ID of the transaction */
            transactionID: PropTypes.string,
        }),
    ),
};

const defaultProps = {
    style: styles.flex1,
    shouldDisableFocusOptions: false,
    reportActions: [],
    reports: {},
    parentReportActions: {},
    policy: {},
    preferredLocale: CONST.LOCALES.DEFAULT,
    personalDetails: {},
    transactions: [],
};

function LHNOptionsList({
    style,
    contentContainerStyles,
    data,
    onSelectRow,
    optionMode,
    shouldDisableFocusOptions,
    reports,
    reportActions,
    parentReportActions,
    policy,
    preferredLocale,
    personalDetails,
    transactions,
}) {

    const itemPersonalDetails = useMemo(() => _.reduce(
        personalDetails,
        (finalPersonalDetails, personalData, accountID) => {
            // It's OK to do param-reassignment in _.reduce() because we absolutely know the starting state of finalPersonalDetails
            // eslint-disable-next-line no-param-reassign
            finalPersonalDetails[accountID] = {
                ...personalData,
                accountID: Number(accountID),
                avatar: UserUtils.getAvatar(personalData.avatar, personalData.accountID),
            };
            return finalPersonalDetails;
        },
        {},
    ), [personalDetails]);
    /**
     * Function which renders a row in the list
     *
     * @param {Object} params
     * @param {Object} params.item
     *
     * @return {Component}
     */
    const renderItem = useCallback(
        ({item}) => {
            const itemFullReport = reports[`${ONYXKEYS.COLLECTION.REPORT}${item}`];
            const itemReportActions = reportActions[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${item}`];
            const itemParentReportActions = parentReportActions[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${itemFullReport.parentReportID}`];
            const itemPolicy = policy[`${ONYXKEYS.COLLECTION.POLICY}${itemFullReport.policyID}`];
            const itemTransaction = itemParentReportActions ? itemParentReportActions[itemFullReport.parentReportActionID].originalMessage.IOUTransactionID : undefined;
            const participantPersonalDetailList = _.values(OptionsListUtils.getPersonalDetailsForAccountIDs(itemFullReport.participantAccountIDs, itemPersonalDetails));
            return (
                <OptionRowLHNDataWithFocus
                    reportID={item}
                    fullReport={itemFullReport}
                    reportActions={itemReportActions}
                    parentReportActions={itemParentReportActions}
                    policy={itemPolicy}
                    personalDetails={participantPersonalDetailList}
                    transaction={itemTransaction}
                    receiptTransactions={transactions}
                    viewMode={optionMode}
                    shouldDisableFocusOptions={shouldDisableFocusOptions}
                    onSelectRow={onSelectRow}
                    preferredLocale={preferredLocale}
                />
            );
        },
        [itemPersonalDetails, onSelectRow, optionMode, parentReportActions, policy, preferredLocale, reportActions, reports, shouldDisableFocusOptions, transactions],
    );

    return (
        <View style={style}>
            <FlashList
                indicatorStyle="white"
                keyboardShouldPersistTaps="always"
                contentContainerStyle={contentContainerStyles}
                data={data}
                keyExtractor={(item) => item}
                renderItem={renderItem}
                estimatedItemSize={optionMode === CONST.OPTION_MODE.COMPACT ? variables.optionRowHeightCompact : variables.optionRowHeight}
            />
        </View>
    );
}

LHNOptionsList.propTypes = propTypes;
LHNOptionsList.defaultProps = defaultProps;

export default withOnyx({
    reports: {
        key: ONYXKEYS.COLLECTION.REPORT,
    },
    reportActions: {
        key: ONYXKEYS.COLLECTION.REPORT_ACTIONS,
    },
    parentReportActions: {
        key: ONYXKEYS.COLLECTION.REPORT_ACTIONS,
    },
    policy: {
        key: ONYXKEYS.COLLECTION.POLICY,
    },
    preferredLocale: {
        key: ONYXKEYS.NVP_PREFERRED_LOCALE,
    },
    personalDetails: {
        key: ONYXKEYS.PERSONAL_DETAILS_LIST,
    },
    transactions: {
        key: ONYXKEYS.COLLECTION.TRANSACTION,
    },
})(LHNOptionsList);
