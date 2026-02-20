import type {ReactNode} from 'react';
import React from 'react';
import {View} from 'react-native';
import Text from '@components/Text';
import useStyleUtils from '@hooks/useStyleUtils';
import useThemeStyles from '@hooks/useThemeStyles';

type ListItemRightCaretWithLabelProps = {
    labelText?: string;
    caret?: ReactNode;
};

function ListItemRightCaretWithLabel({labelText, caret}: ListItemRightCaretWithLabelProps) {
    const styles = useThemeStyles();
    const StyleUtils = useStyleUtils();

    return (
        <View style={styles.flexRow}>
            <View style={[StyleUtils.getMinimumWidth(60)]}>{!!labelText && <Text style={[styles.textAlignCenter, styles.textSupporting, styles.label]}>{labelText}</Text>}</View>
            {!!caret && <View style={[styles.pl2]}>{caret}</View>}
        </View>
    );
}

export default ListItemRightCaretWithLabel;
