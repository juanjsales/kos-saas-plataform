import { Router } from 'express';
import { createService, updateService, deleteService, getServices } from '../controllers/serviceController.js';

const router = Router();

router.get('/', getServices);
router.post('/', createService);
router.put('/:id', updateService);
router.delete('/:id', deleteService);

export default router;
