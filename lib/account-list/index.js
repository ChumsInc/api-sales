import {Router} from 'express'
import {getAccountList, renderAccountList, renderAccountListXLSX} from './bill-to.js';
import {getShipToAccountList, renderShipToAccountList, renderShipToAccountListXLSX} from './ship-to.js';

const router = Router();


router.get('/bill-to', getAccountList);
router.post('/bill-to/render', renderAccountList);
router.post('/bill-to/xlsx', renderAccountListXLSX);

router.get('/ship-to', getShipToAccountList);
router.post('/ship-to/render', renderShipToAccountList);
router.post('/ship-to/xlsx', renderShipToAccountListXLSX);

export default router;
