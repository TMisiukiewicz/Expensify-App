import React from 'react';
import {View} from 'react-native';
import Search from '@components/Search';
import WorkspaceSwitcherButton from '@components/WorkspaceSwitcherButton';
import useActiveWorkspace from '@hooks/useActiveWorkspace';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Timing from '@libs/actions/Timing';
import Navigation from '@libs/Navigation/Navigation';
import Performance from '@libs/Performance';
import SignInOrAvatarWithOptionalStatus from '@pages/home/sidebar/SignInOrAvatarWithOptionalStatus';
import * as Session from '@userActions/Session';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';

function TopBar() {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const {activeWorkspaceID} = useActiveWorkspace();

    return (
        <View
            style={[styles.gap4, styles.flexRow, styles.ph5, styles.pv5, styles.justifyContentBetween, styles.alignItemsCenter]}
            dataSet={{dragArea: true}}
        >
            <WorkspaceSwitcherButton activeWorkspaceID={activeWorkspaceID} />
            <Search
                placeholder={translate('sidebarScreen.buttonSearch')}
                onPress={Session.checkIfActionIsAllowed(() => {
                    Performance.markStart(CONST.TIMING.OPEN_SEARCH);
                    Timing.start(CONST.TIMING.OPEN_SEARCH);
                    Navigation.navigate(ROUTES.SEARCH);
                })}
                containerStyle={[styles.flex1]}
            />
            <SignInOrAvatarWithOptionalStatus />
        </View>
    );
}

TopBar.displayName = 'TopBar';

export default TopBar;
