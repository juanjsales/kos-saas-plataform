import { Router } from 'express';
import {
  getNotificationRules,
  upsertNotificationRule,
  toggleNotificationRule
} from '../controllers/notificationController.js';

const router = Router();

router.get('/', getNotificationRules);
router.post('/', upsertNotificationRule);
router.patch('/:id/toggle', toggleNotificationRule);

export default router;
