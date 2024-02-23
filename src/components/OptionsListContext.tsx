import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import * as OptionsListUtils from '@libs/OptionsListUtils';
import * as ReportUtils from '@libs/ReportUtils';
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
            // const time = performance.now();
            // const iseq = deepEqual(reports, previousReports);
            // console.log('deepEqual(reports, previousReports)', performance.now() - time, 'isEqual:', iseq);
            // const {
            //     recentReports: localRecentReports,
            //     personalDetails: localPersonalDetails,
            //     userToInvite: localUserToInvite,
            // } = OptionsListUtils.getSearchOptions(reports, personalDetails, searchTerm.trim(), betas);
            const newOptions = OptionsListUtils.getNewOptions(reports, personalDetails, {betas, searchValue});
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

    useEffect(() => {
        const lastUpdatedReport = ReportUtils.getLastUpdatedReport();
        const newOption = OptionsListUtils.createOptionFromReport(lastUpdatedReport, personalDetails);
        const replaceIndex = options.reports.findIndex((option) => option.reportID === lastUpdatedReport.reportID);

        if (replaceIndex === undefined) {
            return;
        }

        setOptions((prevOptions) => {
            const newOptions = {...prevOptions};
            newOptions.reports[replaceIndex] = newOption;
            return newOptions;
        });
    }, [reports]);

    return <OptionsListContext.Provider value={useMemo(() => ({options, loadOptions}), [options, loadOptions])}>{children}</OptionsListContext.Provider>;
}

const useOptionsListContext = () => useContext(OptionsListContext);

export {OptionsListContextProvider, useOptionsListContext};
