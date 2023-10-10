import PropTypes from 'prop-types';
import React from 'react';
import {View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import _ from 'underscore';
import CONST from '../../CONST';
import styles from '../../styles/styles';
import OptionRowLHNDataWithFocus from './OptionRowLHNDataWithFocus';

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
};

const defaultProps = {
    style: styles.flex1,
    shouldDisableFocusOptions: false,
};

function LHNOptionsList({style, contentContainerStyles, data, onSelectRow, optionMode, shouldDisableFocusOptions}) {
    /**
     * Function which renders a row in the list
     *
     * @param {Object} params
     * @param {Object} params.item
     *
     * @return {Component}
     */
    const renderItem = ({item}) => (
        <OptionRowLHNDataWithFocus
            reportID={item}
            viewMode={optionMode}
            shouldDisableFocusOptions={shouldDisableFocusOptions}
            onSelectRow={onSelectRow}
        />
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
                estimatedItemSize={54}
            />
        </View>
    );
}

LHNOptionsList.propTypes = propTypes;
LHNOptionsList.defaultProps = defaultProps;

export default LHNOptionsList;
