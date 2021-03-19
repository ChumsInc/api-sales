const router = require('express').Router();
const billTo = require('./bill-to');
const shipTo = require('./ship-to');

router.get('/bill-to', billTo.get);
router.post('/bill-to/render', billTo.render);
router.post('/bill-to/xlsx', billTo.xlsx);

router.get('/ship-to', shipTo.get);
router.post('/ship-to/render', shipTo.render);
router.post('/ship-tp/xlsx', shipTo.xlsx);

exports.billTo = billTo;
exports.shipTo = shipTo;
exports.router = router;
