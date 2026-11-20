"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const quiz_controller_js_1 = require("./quiz.controller.js");
const auth_js_1 = require("../../middleware/auth.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.authenticateToken);
router.use(auth_js_1.requireInstituteContext);
router.get('/', quiz_controller_js_1.listQuizzes);
router.post('/', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), quiz_controller_js_1.createQuiz);
router.get('/:id', quiz_controller_js_1.getQuizById);
router.patch('/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), quiz_controller_js_1.updateQuiz);
router.delete('/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), quiz_controller_js_1.deleteQuiz);
// Student Quiz Attempt Routes
router.post('/:id/start', (0, auth_js_1.requireRole)('STUDENT'), quiz_controller_js_1.startQuizAttempt);
router.post('/:id/submit', (0, auth_js_1.requireRole)('STUDENT'), quiz_controller_js_1.submitQuizAttempt);
// Staff / Admin Submissions Analytics
router.get('/:id/submissions', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), quiz_controller_js_1.getQuizSubmissions);
exports.default = router;
