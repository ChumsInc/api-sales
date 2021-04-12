const router = require('express').Router();
const totals = require('./totals');
const detail = require('./detail');

router.get('/:company(chums|bc)/:minDate/:maxDate', totals.getTotals);
router.get('/:company(chums|bc)/:minDate/:maxDate/:SalespersonDivisionNo-:SalespersonNo', detail.getRepDetail);
exports.router = router;
