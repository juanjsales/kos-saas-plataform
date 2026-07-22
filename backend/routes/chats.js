import { Router } from 'express';
import { getChats, getMessages, convertChatToCard } from '../controllers/chatController.js';

const router = Router();

router.get('/', getChats);
router.get('/:chatId/messages', getMessages);
router.post('/convert', convertChatToCard);

export default router;
