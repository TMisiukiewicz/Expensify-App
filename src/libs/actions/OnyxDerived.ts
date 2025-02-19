import type {OnyxEntry} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import OnyxUtils from 'react-native-onyx/dist/OnyxUtils';
import type {NonEmptyTuple, ValueOf} from 'type-fest';
import {getReportAction} from '@libs/ReportActionsUtils';
import {
    computeAllReportErrors,
    computeCanUserPerformWriteAction,
    computeIsChatRoom,
    computeIsExpenseRequest,
    computeIsIOURequest,
    computeIsMoneyRequest,
    computeIsTrackExpenseReport,
    getChatType,
    getReasonAndReportActionThatRequiresAttention,
    hasAnyViolationsToDisplayRBR,
    isThread as isThreadUtil,
} from '@libs/ReportUtils';
import CONST from '@src/CONST';
import type {GetOnyxTypeForKey, OnyxDerivedKey, OnyxDerivedValuesMapping, OnyxKey} from '@src/ONYXKEYS';
import ONYXKEYS from '@src/ONYXKEYS';
import type * as OnyxTypes from '@src/types/onyx';
import type AssertTypesEqual from '@src/types/utils/AssertTypesEqual';
import ObjectUtils from '@src/types/utils/ObjectUtils';
import type SymmetricDifference from '@src/types/utils/SymmetricDifference';

/**
 * A derived value configuration describes:
 *  - a tuple of Onyx keys to subscribe to (dependencies),
 *  - a compute function that derives a value from the dependent Onyx values.
 *    The compute function receives a single argument that's a tuple of the onyx values for the declared dependencies.
 *    For example, if your dependencies are `['report_', 'account'], then compute will receive a [OnyxCollection<Report>, OnyxEntry<Account>]
 */
type OnyxDerivedValueConfig<Key extends ValueOf<typeof ONYXKEYS.DERIVED>, Deps extends NonEmptyTuple<Exclude<OnyxKey, Key>>> = {
    key: Key;
    dependencies: Deps;
    compute: (
        args: {
            -readonly [Index in keyof Deps]: GetOnyxTypeForKey<Deps[Index]>;
        },
        currentValue: OnyxEntry<OnyxDerivedValuesMapping[Key]>,
    ) => OnyxEntry<OnyxDerivedValuesMapping[Key]>;
};

/**
 * Helper function to create a derived value config. This function is just here to help TypeScript infer Deps, so instead of writing this:
 *
 * const conciergeChatReportIDConfig: OnyxDerivedValueConfig<[typeof ONYXKEYS.COLLECTION.REPORT, typeof ONYXKEYS.CONCIERGE_REPORT_ID]> = {
 *     dependencies: [ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.CONCIERGE_REPORT_ID],
 *     ...
 * };
 *
 * We can just write this:
 *
 * const conciergeChatReportIDConfig = createOnyxDerivedValueConfig({
 *     dependencies: [ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.CONCIERGE_REPORT_ID]
 * })
 */
function createOnyxDerivedValueConfig<Key extends ValueOf<typeof ONYXKEYS.DERIVED>, Deps extends NonEmptyTuple<Exclude<OnyxKey, Key>>>(
    config: OnyxDerivedValueConfig<Key, Deps>,
): OnyxDerivedValueConfig<Key, Deps> {
    return config;
}

/**
 * Global map of derived configs.
 * This object holds our derived value configurations.
 */
const ONYX_DERIVED_VALUES = {
    [ONYXKEYS.DERIVED.CONCIERGE_CHAT_REPORT_ID]: createOnyxDerivedValueConfig({
        key: ONYXKEYS.DERIVED.CONCIERGE_CHAT_REPORT_ID,
        dependencies: [ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.CONCIERGE_REPORT_ID],
        compute: ([reports, conciergeChatReportID]) => {
            if (!reports) {
                return undefined;
            }

            const conciergeReport = Object.values(reports).find((report) => {
                if (!report?.participants || isThreadUtil(report)) {
                    return false;
                }

                const participantAccountIDs = new Set(Object.keys(report.participants));
                if (participantAccountIDs.size !== 2) {
                    return false;
                }

                return participantAccountIDs.has(CONST.ACCOUNT_ID.CONCIERGE.toString()) || report?.reportID === conciergeChatReportID;
            });

            return conciergeReport?.reportID;
        },
    }),
    [ONYXKEYS.DERIVED.REPORT_ATTRIBUTES]: createOnyxDerivedValueConfig({
        key: ONYXKEYS.DERIVED.REPORT_ATTRIBUTES,
        dependencies: [ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.DERIVED.CONCIERGE_CHAT_REPORT_ID],
        compute: ([reports, conciergeChatReportID]) => {
            if (!reports) {
                return {};
            }

            return Object.values(reports).reduce<OnyxTypes.OnyxDerivedReportAttibutes>((acc, report) => {
                if (!report) {
                    return acc;
                }

                const isThread = !!(report?.parentReportID && report?.parentReportActionID);
                const isChatReport = report?.type === CONST.REPORT.TYPE.CHAT;
                const isTaskReport = report?.type === CONST.REPORT.TYPE.TASK;

                acc[report.reportID] = {
                    isThread,
                    isChatThread: isThread && report?.type === CONST.REPORT.TYPE.CHAT,
                    isChatRoom: computeIsChatRoom(report),
                    isChatReport: report?.type === CONST.REPORT.TYPE.CHAT,
                    isInvoiceRoom: getChatType(report) === CONST.REPORT.CHAT_TYPE.INVOICE,
                    isTaskReport: report?.type === CONST.REPORT.TYPE.TASK,
                    isInvoiceReport: report?.type === CONST.REPORT.TYPE.INVOICE,
                    isPolicyExpenseChat: getChatType(report) === CONST.REPORT.CHAT_TYPE.POLICY_EXPENSE_CHAT,
                    isExpenseRequest: computeIsExpenseRequest(report),
                    isExpenseReport: report?.type === CONST.REPORT.TYPE.EXPENSE,
                    isMoneyRequestReport: computeIsMoneyRequest(report),
                    isSelfDM: getChatType(report) === CONST.REPORT.CHAT_TYPE.SELF_DM,
                    isConciergeChat: report.reportID === conciergeChatReportID,
                    isSystemChat: getChatType(report) === CONST.REPORT.CHAT_TYPE.SYSTEM,
                    isDefaultRoom: CONST.DEFAULT_POLICY_ROOM_CHAT_TYPES.some((type) => type === getChatType(report)),
                    isUserCreatedPolicyRoom: getChatType(report) === CONST.REPORT.CHAT_TYPE.POLICY_ROOM,
                    isTripRoom: isChatReport && getChatType(report) === CONST.REPORT.CHAT_TYPE.TRIP_ROOM,
                    isChildReport: isThread || isTaskReport,
                    isIOURequest: computeIsIOURequest(report),
                    isTrackExpenseReport: computeIsTrackExpenseReport(report),
                };

                return acc;
            }, {});
        },
    }),
    [ONYXKEYS.DERIVED.REPORTS]: createOnyxDerivedValueConfig({
        key: ONYXKEYS.DERIVED.REPORTS,
        dependencies: [ONYXKEYS.COLLECTION.REPORT, ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS, ONYXKEYS.COLLECTION.REPORT_ACTIONS],
        compute: ([reports, transactionViolations, allReportActions]) => {
            if (!reports || !transactionViolations) {
                return {};
            }

            return Object.values(reports).reduce<OnyxTypes.OnyxDerivedReportsList>((acc, report) => {
                if (!report) {
                    return acc;
                }

                const hasAnyViolations = hasAnyViolationsToDisplayRBR(report, transactionViolations);
                const parentReportAction = getReportAction(report.parentReportID, report.parentReportActionID);
                const reasonAndReportActionThatRequiresAttention = getReasonAndReportActionThatRequiresAttention(report, parentReportAction);
                const reportActions = allReportActions?.[`${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${report.reportID}`] ?? {};
                const errors = computeAllReportErrors(report, reportActions);
                const canUserPerformWriteAction = computeCanUserPerformWriteAction(report);

                acc[report.reportID] = {
                    hasAnyViolations,
                    requiresAttentionFromCurrentUser: !!reasonAndReportActionThatRequiresAttention,
                    errors,
                    canUserPerformWriteAction: canUserPerformWriteAction ?? false,
                };

                return acc;
            }, {});
        },
    }),
} as const;

/**
 * This helper exists to map an array of Onyx keys such as `['report_', 'conciergeReportID']`
 * to the values for those keys (correctly typed) such as `[OnyxCollection<Report>, OnyxEntry<string>]`
 *
 * Note: just using .map, you'd end up with `Array<OnyxCollection<Report>|OnyxEntry<string>>`, which is not what we want. This preserves the order of the keys provided.
 */
function getOnyxValues<Keys extends readonly OnyxKey[]>(keys: Keys): Promise<{[Index in keyof Keys]: GetOnyxTypeForKey<Keys[Index]>}> {
    return Promise.all(keys.map((key) => OnyxUtils.get(key))) as Promise<{[Index in keyof Keys]: GetOnyxTypeForKey<Keys[Index]>}>;
}

/**
 * Initialize all Onyx derived values, store them in Onyx, and setup listeners to update them when dependencies change.
 */
function init() {
    for (const [key, {compute, dependencies}] of ObjectUtils.typedEntries(ONYX_DERIVED_VALUES)) {
        // Create an array to hold the current values for each dependency.
        // We cast its type to match the tuple expected by config.compute.
        let dependencyValues = new Array(dependencies.length) as Parameters<typeof compute>[0];

        OnyxUtils.get(key).then((storedDerivedValue) => {
            let derivedValue = storedDerivedValue;
            if (!derivedValue) {
                getOnyxValues(dependencies).then((values) => {
                    dependencyValues = values;
                    derivedValue = compute(values, derivedValue);
                    Onyx.set(key, derivedValue ?? null);
                });
            }

            const setDependencyValue = <Index extends number>(i: Index, value: Parameters<typeof compute>[0][Index]) => {
                dependencyValues[i] = value;
            };

            const recomputeDerivedValue = () => {
                const newDerivedValue = compute(dependencyValues, derivedValue);
                if (newDerivedValue !== derivedValue) {
                    derivedValue = newDerivedValue;
                    Onyx.set(key, derivedValue ?? null);
                }
            };

            for (let i = 0; i < dependencies.length; i++) {
                const dependencyOnyxKey = dependencies[i];
                if (OnyxUtils.isCollectionKey(dependencyOnyxKey)) {
                    Onyx.connect({
                        key: dependencyOnyxKey,
                        waitForCollectionCallback: true,
                        callback: (value) => {
                            setDependencyValue(i, value);
                            recomputeDerivedValue();
                        },
                    });
                } else {
                    Onyx.connect({
                        key: dependencyOnyxKey,
                        callback: (value) => {
                            setDependencyValue(i, value);
                            recomputeDerivedValue();
                        },
                    });
                }
            }
        });
    }
}

export default init;

// Note: we can't use `as const satisfies...` for ONYX_DERIVED_VALUES without losing type specificity.
// So these type assertions are here to help enforce that ONYX_DERIVED_VALUES has all the keys and the correct types,
// according to the type definitions for derived keys in ONYXKEYS.ts.
type MismatchedDerivedKeysError =
    `Error: ONYX_DERIVED_VALUES does not match ONYXKEYS.DERIVED or OnyxDerivedValuesMapping. The following keys are present in one or the other, but not both: ${SymmetricDifference<
        keyof typeof ONYX_DERIVED_VALUES,
        OnyxDerivedKey
    >}`;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type KeyAssertion = AssertTypesEqual<keyof typeof ONYX_DERIVED_VALUES, OnyxDerivedKey, MismatchedDerivedKeysError>;

type ExpectedDerivedValueComputeReturnTypes = {
    [Key in keyof OnyxDerivedValuesMapping]: OnyxEntry<OnyxDerivedValuesMapping[Key]>;
};
type ActualDerivedValueComputeReturnTypes = {
    [Key in keyof typeof ONYX_DERIVED_VALUES]: ReturnType<(typeof ONYX_DERIVED_VALUES)[Key]['compute']>;
};
type MismatchedDerivedValues = {
    [Key in keyof ExpectedDerivedValueComputeReturnTypes]: ExpectedDerivedValueComputeReturnTypes[Key] extends ActualDerivedValueComputeReturnTypes[Key] ? never : Key;
}[keyof ExpectedDerivedValueComputeReturnTypes];
type MismatchedDerivedValuesError =
    `Error: ONYX_DERIVED_VALUES does not match OnyxDerivedValuesMapping. The following configs have compute functions that do not return the correct type according to OnyxDerivedValuesMapping: ${MismatchedDerivedValues}`;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ComputeReturnTypeAssertion = AssertTypesEqual<MismatchedDerivedValues, never, MismatchedDerivedValuesError>;
