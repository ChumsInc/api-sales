import dayjs from "dayjs";
import {PaceDates, PaceParams} from "./pace-types.js";

/**
 * Returns the min and max dates for the given year and month
 */
export function getDates({year, month}: PaceParams): PaceDates {
    const minDate = dayjs(`${year}-${month}-01`);
    const maxDate = dayjs(minDate).date(minDate.daysInMonth());
    return {
        minDate: minDate.format('YYYY-MM-DD'),
        maxDate: maxDate.format('YYYY-MM-DD'),
    }
}


