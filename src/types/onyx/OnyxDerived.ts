import type {OnyxEntry} from 'react-native-onyx';
import type {ValueOf} from 'type-fest';
import type CONST from '@src/CONST';
import type {Errors} from './OnyxCommon';
import type ReportAction from './ReportAction';

/**
 *
 */
type ReasonAndReportActionThatRequiresAttention = {
    /**
     *
     */
    reason: ValueOf<typeof CONST.REQUIRES_ATTENTION_REASONS>;
    /**
     *
     */
    reportAction?: OnyxEntry<ReportAction>;
};

/**
 *
 */
type ReasonAndReportActionThatHasRedBrickRoad = {
    /**
     *
     */
    reason: ValueOf<typeof CONST.RBR_REASONS>;
    /**
     *
     */
    reportAction?: OnyxEntry<ReportAction>;
};

/**
 *
 */
type BrickRoadStatus = {
    /**
     *
     */
    reasonToHaveRBR: ReasonAndReportActionThatHasRedBrickRoad | null;
    /**
     *
     */
    reasonToHaveGBR: ReasonAndReportActionThatRequiresAttention | null;
    /**
     *
     */
    errors: Errors;
    /**
     *
     */
    canUserPerformWriteAction: boolean;
};

/**
 *
 */
type ReportBrickRoadStatus = Record<string, BrickRoadStatus>;

export type {ReportBrickRoadStatus, ReasonAndReportActionThatRequiresAttention, ReasonAndReportActionThatHasRedBrickRoad};
