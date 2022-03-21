const debug = require('debug')('chums:lib:sps');
const router = require('express').Router();

const {testCSVFile, testExistingCSVFile} = require('./csv-validate');
const {getMapping, postMapping, deleteMapping, getCustomers, postCustomer, getCustomerRecentCSV} = require('./mapping');
const {getOrderVerification} = require('./import-verification');

router.get('/customers', getCustomers);
router.get('/customers/:id(\\d+)', getCustomers);
router.get('/customers/:id(\\d+)/recent', getCustomerRecentCSV);
router.get('/customers/:Company/:ARDivisionNo-:CustomerNo', getCustomers);
router.post('/customers/:Company/:ARDivisionNo-:CustomerNo', postCustomer);

router.get('/mapping/:Company/:ARDivisionNo-:CustomerNo', getMapping);
router.post('/mapping/:Company/:ARDivisionNo-:CustomerNo', postMapping);
router.delete('/mapping/:Company/:ARDivisionNo-:CustomerNo/:id', deleteMapping);

router.post('/upload', testCSVFile);
router.post('/test-csv/:id', testExistingCSVFile);
router.post('/verify-orders', getOrderVerification);

// router.get('/update/mapped-options', fixMappedValueToMappedOptions);

exports.router = router;
