import { Router } from 'express';
import multer from 'multer';
import {
  createCard,
  updateCardStatus,
  getCards,
  confirmCard,
  analyzeCardAttachment,
  completeCardWithAttachment,
  executeAutomation
} from '../controllers/cardController.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const router = Router();

router.post('/', createCard);
router.get('/', getCards);
router.patch('/:id/status', updateCardStatus);
router.post('/:id/confirm', confirmCard);
router.post('/analyze-attachment', upload.single('document'), analyzeCardAttachment);
router.post('/:id/complete-attachment', upload.single('document'), completeCardWithAttachment);
router.post('/:id/complete-with-attachment', upload.single('document'), completeCardWithAttachment);
router.post('/:id/execute-automation', executeAutomation);

export default router;
