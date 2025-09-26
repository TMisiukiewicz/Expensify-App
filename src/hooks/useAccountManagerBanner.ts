import {useCallback, useMemo, useState} from 'react';
import type {OnyxEntry} from 'react-native-onyx';
import Navigation from '@libs/Navigation/Navigation';
import {getPersonalDetailsForAccountIDs} from '@libs/OptionsListUtils';
import {getDisplayNameOrDefault} from '@libs/PersonalDetailsUtils';
import {getParticipantsAccountIDsForDisplay, isConciergeChatReport} from '@libs/ReportUtils';
import ROUTES from '@src/ROUTES';
import type * as OnyxTypes from '@src/types/onyx';
import useLocalize from './useLocalize';

type UseAccountManagerBannerProps = {
    /** Current report object */
    report: OnyxEntry<OnyxTypes.Report>;
    /** Account manager report ID */
    accountManagerReportID: string | undefined;
    /** Account manager report object */
    accountManagerReport: OnyxEntry<OnyxTypes.Report>;
    /** Personal details list */
    personalDetails: OnyxEntry<OnyxTypes.PersonalDetailsList>;
};

type UseAccountManagerBannerReturn = {
    /** Whether to show the account manager banner */
    shouldShowBanner: boolean;
    /** Banner text to display */
    bannerText: string;
    /** Whether the banner is visible (not dismissed) */
    isBannerVisible: boolean;
    /** Function to dismiss the banner */
    dismissBanner: () => void;
    /** Function to navigate to account manager chat */
    chatWithAccountManager: () => void;
};

function useAccountManagerBanner({report, accountManagerReportID, accountManagerReport, personalDetails}: UseAccountManagerBannerProps): UseAccountManagerBannerReturn {
    const {translate} = useLocalize();
    const [isBannerVisible, setIsBannerVisible] = useState(true);

    // Compute banner text
    const bannerText = useMemo(() => {
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

    // Determine if banner should be shown
    const shouldShowBanner = !!accountManagerReportID && isConciergeChatReport(report) && isBannerVisible;

    // Banner action handlers
    const dismissBanner = useCallback(() => {
        setIsBannerVisible(false);
    }, []);

    const chatWithAccountManager = useCallback(() => {
        Navigation.navigate(ROUTES.REPORT_WITH_ID.getRoute(accountManagerReportID));
    }, [accountManagerReportID]);

    return {
        shouldShowBanner,
        bannerText,
        isBannerVisible,
        dismissBanner,
        chatWithAccountManager,
    };
}

export default useAccountManagerBanner;
