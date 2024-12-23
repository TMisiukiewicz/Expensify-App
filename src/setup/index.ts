import {I18nManager} from 'react-native';
import Onyx from 'react-native-onyx';
import intlPolyfill from '@libs/IntlPolyfill';
import * as Device from '@userActions/Device';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import addUtilsToWindow from './addUtilsToWindow';
import initializeLastVisitedPath from './initializeLastVisitedPath';
import platformSetup from './platformSetup';

export default function () {
    /*
     * Initialize the Onyx store when the app loads for the first time.
     *
     * Note: This Onyx initialization has been very intentionally placed completely outside of the React lifecycle of the main App component.
     *
     * To understand why we must do this, you must first understand that a typical React Native Android application consists of an Application and an Activity.
     * The project root's index.js runs in the Application, but the main RN `App` component + UI runs in a separate Activity, spawned when you call AppRegistry.registerComponent.
     * When an application launches in a headless JS context (i.e: when woken from a killed state by a push notification), only the Application is available, but not the UI Activity.
     * This means that in a headless context NO REACT CODE IS EXECUTED, and none of your components will mount.
     *
     * However, we still need to use Onyx to update the underlying app data from the headless JS context.
     * Therefore it must be initialized completely outside the React component lifecycle.
     */
    Onyx.init({
        keys: ONYXKEYS,

        // Increase the cached key count so that the app works more consistently for accounts with large numbers of reports
        maxCachedKeysCount: 20000,
        safeEvictionKeys: [ONYXKEYS.COLLECTION.REPORT_ACTIONS],
        initialKeyStates: {
            // Clear any loading and error messages so they do not appear on app startup
            [ONYXKEYS.SESSION]: {loading: false},
            [ONYXKEYS.ACCOUNT]: CONST.DEFAULT_ACCOUNT_DATA,
            [ONYXKEYS.NETWORK]: CONST.DEFAULT_NETWORK_DATA,
            [ONYXKEYS.IS_SIDEBAR_LOADED]: false,
            [ONYXKEYS.SHOULD_SHOW_COMPOSE_INPUT]: true,
            [ONYXKEYS.MODAL]: {
                isVisible: false,
                willAlertModalBecomeVisible: false,
            },
            // Always open the home route on app startup for native platforms by clearing the lastVisitedPath
            [ONYXKEYS.LAST_VISITED_PATH]: initializeLastVisitedPath(),
        },
        schema: {
            [ONYXKEYS.IS_LOADING_APP]: {
                type: 'boolean',
            },
            [ONYXKEYS.COLLECTION.REPORT]: {
                type: 'object',
                pattern: /^report_\d+$/,
                properties: {
                    avatarUrl: {type: 'string'},
                    chatType: {type: 'string'},
                    description: {type: 'string'},
                    errorFields: {type: 'object'},
                    fieldList: {type: 'object'},
                    iouReportID: {type: 'string'},
                    isCancelledIOU: {type: 'boolean'},
                    isDeletedParentAction: {type: 'boolean'},
                    isWaitingOnBankAccount: {type: 'boolean'},
                    invoiceReceiver: {type: 'object'},
                    lastActionType: {type: 'string'},
                    lastActorAccountID: {type: 'string'},
                    lastMessageHtml: {type: 'string'},
                    lastVisibleActionLastModified: {type: 'string'},
                    managerID: {type: 'number'},
                    nonReimbursableTotal: {type: 'number'},
                    oldPolicyName: {type: 'string'},
                    ownerAccountID: {type: 'number'},
                    parentReportActionID: {type: 'string'},
                    parentReportID: {type: 'string'},
                    permissions: {type: 'array', items: {type: 'string'}},
                    policyAvatar: {type: 'string'},
                    policyID: {type: 'string'},
                    policyName: {type: 'string'},
                    private_isArchived: {type: 'string'},
                    reportName: {type: 'string'},
                    tripData: {
                        type: 'object',
                        properties: {
                            startDate: {type: 'string'},
                            endDate: {type: 'string'},
                            tripID: {type: 'string'},
                        },
                    },
                    unheldNonReimbursableTotal: {type: 'number'},
                    unheldTotal: {type: 'number'},
                    welcomeMessage: {type: 'string'},
                    hasParentAccess: {type: 'boolean'},
                    hasOutstandingChildRequest: {type: 'boolean'},
                    hasOutstandingChildTask: {type: 'boolean'},
                    isOwnPolicyExpenseChat: {type: 'boolean'},
                    isPinned: {type: 'boolean'},
                    lastMessageText: {type: 'string'},
                    lastVisibleActionCreated: {type: 'string'},
                    lastReadTime: {type: 'string'},
                    lastReadSequenceNumber: {type: 'number'},
                    lastMentionedTime: {type: 'string'},
                    reportID: {type: 'string'},
                    chatReportID: {type: 'string'},
                    stateNum: {type: 'number'},
                    statusNum: {type: 'number'},
                    writeCapability: {type: 'string'},
                    type: {type: 'string'},
                    visibility: {type: 'string'},
                    participants: {
                        type: 'object',
                        properties: {
                            '*': {
                                type: 'object',
                                properties: {
                                    role: {type: 'string'},
                                    notificationPreference: {type: 'string'},
                                },
                            },
                        },
                    },
                    total: {type: 'number'},
                    currency: {type: 'string'},
                    pendingChatMembers: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                accountID: {type: 'string'},
                                pendingAction: {type: 'string'},
                                errors: {type: 'object'},
                            },
                        },
                    },
                    privateNotes: {
                        type: 'object',
                        properties: {
                            '*': {
                                type: 'object',
                                properties: {
                                    note: {type: 'string'},
                                    errors: {type: 'object'},
                                },
                            },
                        },
                    },
                },
            },
        },
        onSchemaError: (key, value, error) => {
            console.log({key, value, error});
        },
    });

    Device.setDeviceID();

    // Force app layout to work left to right because our design does not currently support devices using this mode
    I18nManager.allowRTL(false);
    I18nManager.forceRTL(false);

    // Polyfill the Intl API if locale data is not as expected
    intlPolyfill();

    // Perform any other platform-specific setup
    platformSetup();

    addUtilsToWindow();
}
