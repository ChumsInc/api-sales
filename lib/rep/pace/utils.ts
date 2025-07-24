import Decimal from "decimal.js";
import Debug from 'debug';

const debug = Debug('chums:lib:rep:pace:utils');

export function calcGrowthRate(current:string|number|Decimal, prev: string|number|Decimal):Decimal {
    if (new Decimal(prev).eq(0)) {
        return new Decimal(new Decimal(current).lte(0) ? 0 : 1);
    }
    return new Decimal(current).sub(prev).div(new Decimal(prev).abs())
}

export function calcPace(prev:string|number|Decimal, rate:string|number|Decimal):Decimal {
    return new Decimal(rate).add(1).times(prev);
}
