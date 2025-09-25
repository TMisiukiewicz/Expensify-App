import {useEffect, useRef} from 'react';
import {DeviceEventEmitter, InteractionManager} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
import {isValidReportIDFromPath} from '@libs/ReportUtils';
import {setShouldShowComposeInput} from '@userActions/Composer';
import {subscribeToReportLeavingEvents, unsubscribeFromLeavingRoomReportChannel} from '@userActions/Report';
import type * as OnyxTypes from '@src/types/onyx';

type UseReportSubscriptionsProps = {
    /** Current report object */
    report: OnyxEntry<OnyxTypes.Report>;
    /** Report ID from route parameters */
    reportIDFromRoute: string | undefined;
    /** Current report ID */
    reportID: string | undefined;
    /** Report metadata including loading states */
    reportMetadata: OnyxEntry<OnyxTypes.ReportMetadata>;
    /** Ref to track if skipping open report */
    isSkippingOpenReport: React.MutableRefObject<boolean>;
    /** Callback to set linking to message state */
    setIsLinkingToMessage: (value: boolean) => void;
};

/**
 * Hook to handle report subscription management and event listeners
 */
function useReportSubscriptions({report, reportIDFromRoute, reportID, reportMetadata, isSkippingOpenReport, setIsLinkingToMessage}: UseReportSubscriptionsProps) {
    const didSubscribeToReportLeavingEvents = useRef(false);

    // Set up compose input and cleanup on unmount
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

    // Subscribe to report leaving events when report is created successfully
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
    }, [report, reportIDFromRoute]);

    // Handle device event for switching to pre-existing reports
    useEffect(() => {
        const skipOpenReportListener = DeviceEventEmitter.addListener(`switchToPreExistingReport_${reportID}`, ({preexistingReportID}: {preexistingReportID: string}) => {
            if (!preexistingReportID) {
                return;
            }
            // eslint-disable-next-line react-compiler/react-compiler, no-param-reassign
            isSkippingOpenReport.current = true;
        });

        return () => {
            skipOpenReportListener.remove();
        };
    }, [reportID, isSkippingOpenReport]);

    // Handle linking to message state changes to prevent blinking
    useEffect(() => {
        // This helps in tracking from the moment 'route' triggers useMemo until isLoadingInitialReportActions becomes true. It prevents blinking when loading reportActions from cache.
        InteractionManager.runAfterInteractions(() => {
            setIsLinkingToMessage(false);
        });
    }, [reportMetadata?.isLoadingInitialReportActions, setIsLinkingToMessage]);
}

export default useReportSubscriptions;
