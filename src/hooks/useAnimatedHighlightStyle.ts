import {useFocusEffect} from '@react-navigation/native';
import React from 'react';
import {InteractionManager} from 'react-native';
import {interpolateColor, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming} from 'react-native-reanimated';
import CONST from '@src/CONST';
import useTheme from './useTheme';

/**
 * Returns a highlight style that interpolates the colour giving a fading effect.
 */
export default function useAnimatedHighlightStyle(shouldHighlight: boolean, highlightDuration: number = CONST.ANIMATED_TRANSITION, delay = 100) {
    const highlightProgress = useSharedValue(0);
    const theme = useTheme();

    const highlightBackgroundStyle = useAnimatedStyle(() => ({
        backgroundColor: interpolateColor(highlightProgress.value, [0, 1], ['rgba(0, 0, 0, 0)', theme.border]),
    }));

    useFocusEffect(
        React.useCallback(() => {
            if (!shouldHighlight) {
                return;
            }
            InteractionManager.runAfterInteractions(() => {
                highlightProgress.value = withSequence(
                    withDelay(delay, withTiming(0)),
                    withTiming(1, {duration: highlightDuration}),
                    withDelay(delay, withTiming(1)),
                    withTiming(0, {duration: highlightDuration}),
                );
            });
        }, [shouldHighlight, highlightDuration, delay, highlightProgress]),
    );

    return highlightBackgroundStyle;
}
