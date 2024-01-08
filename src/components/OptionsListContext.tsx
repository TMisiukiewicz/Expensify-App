import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import * as OptionsListUtils from '@libs/OptionsListUtils';
import {useBetas, usePersonalDetails, useReports} from './OnyxProvider';

const OptionsListContext = createContext({
    options: {},
});

function OptionsListContextProvider({children}) {
    const [options, setOptions] = useState({
        reports: [],
        personalDetails: [],
    });
    const personalDetails = usePersonalDetails();
    const betas = useBetas();
    const reports = useReports();

    const loadOptions = useCallback(
        (searchValue = '') => {
            // const {
            //     recentReports: localRecentReports,
            //     personalDetails: localPersonalDetails,
            //     userToInvite: localUserToInvite,
            // } = OptionsListUtils.getSearchOptions(reports, personalDetails, searchTerm.trim(), betas);
            const newOptions = OptionsListUtils.getNewOptions(reports, personalDetails, {betas, searchValue});
            // console.log({newOptions});
            setOptions({
                reports: newOptions.reportsOptions,
                personalDetails: newOptions.personalDetailsOptions,
            });
        },
        [betas, personalDetails, reports],
    );

    useEffect(() => {
        loadOptions();
    }, []);

    return <OptionsListContext.Provider value={useMemo(() => ({options, loadOptions}), [options, loadOptions])}>{children}</OptionsListContext.Provider>;
}

const useOptionsListContext = () => useContext(OptionsListContext);

export {OptionsListContextProvider, useOptionsListContext};
