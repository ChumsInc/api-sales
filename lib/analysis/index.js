const router = require('express').Router();
const queryHandler = require('./query-handler');

router.get('/', queryHandler.getDivision);
router.post('/', queryHandler.getDivision);

exports.router = router;
