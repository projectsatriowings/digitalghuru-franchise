"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const recorded_sessions_controller_js_1 = require("./recorded-sessions.controller.js");
const auth_js_1 = require("../../middleware/auth.js");
const storage_js_1 = require("../../utils/storage.js");
const router = (0, express_1.Router)();
// List recorded sessions (Students, Parents, Trainers, Admins, Franchise Owners)
router.get('/', auth_js_1.authenticateToken, recorded_sessions_controller_js_1.listRecordedSessions);
// Direct video file upload from the system
router.post('/upload', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'BRANCH_ADMIN', 'STAFF'), storage_js_1.courseMediaUpload.single('file'), recorded_sessions_controller_js_1.uploadSessionVideo);
// Create / Publish a recorded session (via direct link or uploaded video URL)
router.post('/', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'BRANCH_ADMIN', 'STAFF'), recorded_sessions_controller_js_1.createRecordedSession);
// Delete a recorded session
router.delete('/:id', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'BRANCH_ADMIN', 'STAFF'), recorded_sessions_controller_js_1.deleteRecordedSession);
exports.default = router;
