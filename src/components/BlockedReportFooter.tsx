import React from 'react';
import {useMemoizedLazyExpensifyIcons} from '@hooks/useLazyAsset';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Banner from './Banner';

function BlockedReportFooter() {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const expensifyIcons = useMemoizedLazyExpensifyIcons(['Exclamation']);

    const text = translate('youHaveBeenBanned');

    return (
        <Banner
            containerStyles={[styles.chatFooterBanner]}
            text={text}
            icon={expensifyIcons.Exclamation}
            shouldRenderHTML
        />
    );
}

export default BlockedReportFooter;
