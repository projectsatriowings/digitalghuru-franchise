import { Router } from 'express';
import {
  getOrCreateConversation,
  listUserConversations,
  getConversationMessages,
  sendMessage,
  uploadChatAttachment,
  getAttachmentFile,
  getEligibleContacts,
} from './messaging.controller.js';
import { authenticateToken, requireInstituteContext } from '../../middleware/auth.js';
import { fileUpload } from '../../utils/storage.js';

const router = Router();

router.use(authenticateToken);
router.use(requireInstituteContext);

router.get('/conversations', listUserConversations);
router.post('/conversations', getOrCreateConversation);
router.get('/conversations/:id/messages', getConversationMessages);
router.post('/conversations/:id/messages', sendMessage);

// Attachment handling
router.post('/conversations/:id/attachments', fileUpload.single('file'), uploadChatAttachment);
router.get('/conversations/:id/attachments/:filename', getAttachmentFile);

// Contact directory for initiating conversations
router.get('/eligible-contacts', getEligibleContacts);

export default router;
