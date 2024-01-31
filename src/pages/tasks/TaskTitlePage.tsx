import React, {useCallback, useRef} from 'react';
import {View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import type {OnyxEntry} from 'react-native-onyx';
import FullPageNotFoundView from '@components/BlockingViews/FullPageNotFoundView';
import FormProvider from '@components/Form/FormProvider';
import InputWrapper from '@components/Form/InputWrapper';
import type {OnyxFormValuesFields} from '@components/Form/types';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import type {AnimatedTextInputRef} from '@components/RNTextInput';
import ScreenWrapper from '@components/ScreenWrapper';
import TextInput from '@components/TextInput';
import withCurrentUserPersonalDetails from '@components/withCurrentUserPersonalDetails';
import type {WithCurrentUserPersonalDetailsProps} from '@components/withCurrentUserPersonalDetails';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import Navigation from '@libs/Navigation/Navigation';
import * as ReportUtils from '@libs/ReportUtils';
import withReportOrNotFound from '@pages/home/report/withReportOrNotFound';
import type {WithReportOrNotFoundProps} from '@pages/home/report/withReportOrNotFound';
import * as Task from '@userActions/Task';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Policy, PolicyRole} from '@src/types/onyx';
import {isEmptyObject} from '@src/types/utils/EmptyObject';

type TaskTitlePageOnyxProps = {
    /** The policy of parent report */
    rootParentReportPolicy: OnyxEntry<PolicyRole>;
};

type TaskTitlePageProps = WithReportOrNotFoundProps & WithCurrentUserPersonalDetailsProps & TaskTitlePageOnyxProps;

type Values = {
    title: string;
};

type Errors = {
    title?: string;
};

function TaskTitlePage({report, rootParentReportPolicy, currentUserPersonalDetails}: TaskTitlePageProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();

    const validate = useCallback(({title}: Values): Errors => {
        const errors: Errors = {};

        if (!title) {
            errors.title = 'newTaskPage.pleaseEnterTaskName';
        }

        return errors;
    }, []);

    const submit = useCallback(
        (values: OnyxFormValuesFields<typeof ONYXKEYS.FORMS.EDIT_TASK_FORM>) => {
            if (values.title !== report?.reportName && !isEmptyObject(report)) {
                // Set the title of the report in the store and then call EditTask API
                // to update the title of the report on the server
                Task.editTask(report, {title: values.title});
            }

            Navigation.dismissModal(report?.reportID);
        },
        [report],
    );

    if (!ReportUtils.isTaskReport(report)) {
        Navigation.isNavigationReady().then(() => {
            Navigation.dismissModal(report?.reportID);
        });
    }

    const inputRef = useRef<AnimatedTextInputRef | null>(null);
    const isOpen = ReportUtils.isOpenTaskReport(report);
    const canModifyTask = Task.canModifyTask(report, currentUserPersonalDetails.accountID, rootParentReportPolicy?.role);
    const isTaskNonEditable = ReportUtils.isTaskReport(report) && (!canModifyTask || !isOpen);

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            onEntryTransitionEnd={() => {
                inputRef?.current?.focus();
            }}
            shouldEnableMaxHeight
            testID={TaskTitlePage.displayName}
        >
            {({didScreenTransitionEnd}) => (
                <FullPageNotFoundView shouldShow={isTaskNonEditable}>
                    <HeaderWithBackButton title={translate('task.task')} />
                    <FormProvider
                        style={[styles.flexGrow1, styles.ph5]}
                        formID={ONYXKEYS.FORMS.EDIT_TASK_FORM}
                        validate={validate}
                        onSubmit={submit}
                        submitButtonText={translate('common.save')}
                        enabledWhenOffline
                    >
                        <View style={[styles.mb4]}>
                            <InputWrapper
                                InputComponent={TextInput}
                                role={CONST.ROLE.PRESENTATION}
                                inputID="title"
                                name="title"
                                label={translate('task.title')}
                                accessibilityLabel={translate('task.title')}
                                defaultValue={report?.reportName ?? ''}
                                ref={(element: AnimatedTextInputRef) => {
                                    if (!element) {
                                        return;
                                    }
                                    if (!inputRef.current && didScreenTransitionEnd) {
                                        element.focus();
                                    }
                                    inputRef.current = element;
                                }}
                            />
                        </View>
                    </FormProvider>
                </FullPageNotFoundView>
            )}
        </ScreenWrapper>
    );
}

TaskTitlePage.displayName = 'TaskTitlePage';

const ComponentWithOnyx = withOnyx<TaskTitlePageProps, TaskTitlePageOnyxProps>({
    rootParentReportPolicy: {
        key: ({report}) => {
            const rootParentReport = ReportUtils.getRootParentReport(report);
            return `${ONYXKEYS.COLLECTION.POLICY}${rootParentReport ? rootParentReport.policyID : '0'}`;
        },
        selector: (policy: OnyxEntry<Policy>) => ({role: policy?.role}),
    },
})(TaskTitlePage);

const ComponentWithCurrentUserPersonalDetails = withCurrentUserPersonalDetails(ComponentWithOnyx);

export default withReportOrNotFound()(ComponentWithCurrentUserPersonalDetails);
