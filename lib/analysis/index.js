import {Router} from 'express'
const router = Router();
import {getSalesAnalysis} from './query-handler.js';

router.get('/', getSalesAnalysis);
router.post('/', getSalesAnalysis);

export default router;
