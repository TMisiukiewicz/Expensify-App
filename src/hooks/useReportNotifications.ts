import {useCallback, useEffect} from 'react';
import {useIsFocused} from '@react-navigation/native';
import clearReportNotifications from '@libs/Notification/clearReportNotifications';
import {updateLastVisitTime} from '@userActions/Report';
import useAppFocusEvent from './useAppFocusEvent';

type UseReportNotificationsProps = {
    /** Current report ID */
    reportID: string | undefined;
    /** Whether this is the top-most report screen */
    isTopMostReportId: boolean;
};

/**
 * Hook to handle report notification management and user presence tracking
 */
function useReportNotifications({reportID, isTopMostReportId}: UseReportNotificationsProps) {
    const isFocused = useIsFocused();

    // Update last visit time when report is focused
    useEffect(() => {
        if (!reportID || !isFocused) {
            return;
        }
        updateLastVisitTime(reportID);
    }, [reportID, isFocused]);

    // Clear notifications for the current report when it's opened and re-focused
    const clearNotifications = useCallback(() => {
        // Check if this is the top-most ReportScreen since the Navigator preserves multiple at a time
        if (!isTopMostReportId || !reportID) {
            return;
        }

        clearReportNotifications(reportID);
    }, [reportID, isTopMostReportId]);

    // Clear notifications on mount and when dependencies change
    useEffect(clearNotifications, [clearNotifications]);
    
    // Clear notifications when app regains focus
    useAppFocusEvent(clearNotifications);
}

export default useReportNotifications;