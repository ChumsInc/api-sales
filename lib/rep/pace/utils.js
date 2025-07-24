import Decimal from "decimal.js";
import Debug from 'debug';
const debug = Debug('chums:lib:rep:pace:utils');
export function calcGrowthRate(current, prev) {
    if (new Decimal(prev).eq(0)) {
        return new Decimal(new Decimal(current).lte(0) ? 0 : 1);
    }
    return new Decimal(current).sub(prev).div(new Decimal(prev).abs());
}
export function calcPace(prev, rate) {
    return new Decimal(rate).add(1).times(prev);
}
