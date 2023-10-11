import PropTypes from 'prop-types';
import React, {useCallback} from 'react';
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
};

const defaultProps = {
    style: styles.flex1,
    shouldDisableFocusOptions: false,
    reportActions: [],
    reports: {},
    parentReportActions: {},
    policy: {}
};

function LHNOptionsList({style, contentContainerStyles, data, onSelectRow, optionMode, shouldDisableFocusOptions, reports, reportActions, parentReportActions, policy}) {
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

            return (
                <OptionRowLHNDataWithFocus
                    reportID={item}
                    fullReport={itemFullReport}
                    reportActions={itemReportActions}
                    parentReportActions={itemParentReportActions}
                    policy={itemPolicy}
                    viewMode={optionMode}
                    shouldDisableFocusOptions={shouldDisableFocusOptions}
                    onSelectRow={onSelectRow}
                />
            );
        },
        [onSelectRow, optionMode, parentReportActions, policy, reportActions, reports, shouldDisableFocusOptions],
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
})(LHNOptionsList);
