import { Router } from 'express';
import { createService, getServices } from '../controllers/serviceController.js';

const router = Router();

router.post('/', createService);
router.get('/', getServices);

export default router;
