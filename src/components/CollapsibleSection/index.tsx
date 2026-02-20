import type {ReactNode} from 'react';
import React, {useState} from 'react';
import type {StyleProp, TextStyle, ViewStyle} from 'react-native';
import {View} from 'react-native';
import Icon from '@components/Icon';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import Text from '@components/Text';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import type ChildrenProps from '@src/types/utils/ChildrenProps';
import Collapsible from './Collapsible';

type CollapsibleSectionProps = ChildrenProps & {
    /** Title of the Collapsible section */
    title: string;

    /** Style of title of the collapsible section */
    titleStyle?: StyleProp<TextStyle>;

    /** Style for the text */
    textStyle?: StyleProp<TextStyle>;

    /** Style for the wrapper view */
    wrapperStyle?: StyleProp<ViewStyle>;

    /** Optional element to render between the section title and expandable items */
    sectionBorder?: ReactNode;
};

function CollapsibleSection({title, children, titleStyle, textStyle, wrapperStyle, sectionBorder}: CollapsibleSectionProps) {
    const icons = useMemoizedLazyExpensifyIcons(['DownArrow', 'UpArrow']);
    const theme = useTheme();
    const styles = useThemeStyles();
    const [isExpanded, setIsExpanded] = useState(false);

    /**
     * Expands/collapses the section
     */
    const toggleSection = () => {
        setIsExpanded(!isExpanded);
    };

    const src = isExpanded ? icons.UpArrow : icons.DownArrow;

    return (
        <View style={[styles.mt4, wrapperStyle]}>
            <PressableWithFeedback
                onPress={toggleSection}
                style={[styles.pb4, styles.flexRow]}
                role={CONST.ROLE.BUTTON}
                accessibilityLabel={title}
                hoverDimmingValue={1}
                pressDimmingValue={0.2}
            >
                <Text
                    style={textStyle ?? [styles.flex1, styles.textStrong, styles.userSelectNone, titleStyle]}
                    dataSet={{[CONST.SELECTION_SCRAPER_HIDDEN_ELEMENT]: true}}
                >
                    {title}
                </Text>
                <Icon
                    fill={theme.icon}
                    src={src}
                />
            </PressableWithFeedback>
            {sectionBorder}
            <Collapsible isOpened={isExpanded}>
                <View>{children}</View>
            </Collapsible>
        </View>
    );
}

export default CollapsibleSection;
