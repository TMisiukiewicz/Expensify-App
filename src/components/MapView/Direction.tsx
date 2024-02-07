// import Mapbox from '@rnmapbox/maps';
import useThemeStyles from '@hooks/useThemeStyles';
import type {DirectionProps} from './MapViewTypes';

function Direction({coordinates}: DirectionProps) {
    const styles = useThemeStyles();
    if (coordinates.length < 1) {
        return null;
    }

    return <></>;
}

Direction.displayName = 'Direction';

export default Direction;
