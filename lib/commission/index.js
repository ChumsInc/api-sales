import {Router} from "express";
import {getCommissionTotals} from './totals.js';
import {getRepCommissionDetail} from './detail.js';


const router = Router();

router.get('/:company(chums|bc)/:minDate/:maxDate', getCommissionTotals);
router.get('/:company(chums|bc)/:minDate/:maxDate/:SalespersonDivisionNo-:SalespersonNo', getRepCommissionDetail);

export default router;
