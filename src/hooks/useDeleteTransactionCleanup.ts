import {useCallback, useEffect} from 'react';
import {InteractionManager} from 'react-native';
import {clearDeleteTransactionNavigateBackUrl} from '@userActions/Report';
import ONYXKEYS from '@src/ONYXKEYS';
import useOnyx from './useOnyx';

type UseDeleteTransactionCleanupProps = {
    /** Whether the screen is currently focused */
    isFocused: boolean;
};

/**
 * Hook to handle delete transaction URL cleanup when screen gains focus
 */
function useDeleteTransactionCleanup({isFocused}: UseDeleteTransactionCleanupProps): void {
    const [deleteTransactionNavigateBackUrl] = useOnyx(ONYXKEYS.NVP_DELETE_TRANSACTION_NAVIGATE_BACK_URL, {canBeMissing: true});

    const clearDeleteTransactionUrl = useCallback(() => {
        InteractionManager.runAfterInteractions(() => {
            requestAnimationFrame(() => {
                clearDeleteTransactionNavigateBackUrl();
            });
        });
    }, []);

    useEffect(() => {
        if (!isFocused || !deleteTransactionNavigateBackUrl) {
            return;
        }
        // Clear the URL after all interactions are processed to ensure all updates are completed before hiding the skeleton
        clearDeleteTransactionUrl();
    }, [isFocused, deleteTransactionNavigateBackUrl, clearDeleteTransactionUrl]);
}

export default useDeleteTransactionCleanup;