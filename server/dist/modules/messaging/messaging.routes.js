"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const messaging_controller_js_1 = require("./messaging.controller.js");
const auth_js_1 = require("../../middleware/auth.js");
const storage_js_1 = require("../../utils/storage.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.authenticateToken);
router.use(auth_js_1.requireInstituteContext);
router.get('/conversations', messaging_controller_js_1.listUserConversations);
router.post('/conversations', messaging_controller_js_1.getOrCreateConversation);
router.get('/conversations/:id/messages', messaging_controller_js_1.getConversationMessages);
router.post('/conversations/:id/messages', messaging_controller_js_1.sendMessage);
// Attachment handling
router.post('/conversations/:id/attachments', storage_js_1.fileUpload.single('file'), messaging_controller_js_1.uploadChatAttachment);
router.get('/conversations/:id/attachments/:filename', messaging_controller_js_1.getAttachmentFile);
// Contact directory for initiating conversations
router.get('/eligible-contacts', messaging_controller_js_1.getEligibleContacts);
exports.default = router;
