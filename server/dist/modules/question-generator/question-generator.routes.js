"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const question_generator_controller_js_1 = require("./question-generator.controller.js");
const auth_js_1 = require("../../middleware/auth.js");
const storage_js_1 = require("../../utils/storage.js");
const router = (0, express_1.Router)();
// Base protection: Must be authenticated and bound to active institute
router.use(auth_js_1.authenticateToken);
router.use(auth_js_1.requireInstituteContext);
// Strictly restrict paper generation and management to Staff and Administrators
const requireStaffOrAdmin = (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF');
// Configuration & Blueprint Validation
router.get('/config', requireStaffOrAdmin, question_generator_controller_js_1.getConfig);
router.post('/blueprint/validate', requireStaffOrAdmin, question_generator_controller_js_1.validateBlueprint);
// Syllabus Extraction
router.post('/extract-syllabus', requireStaffOrAdmin, storage_js_1.fileUpload.single('file'), question_generator_controller_js_1.extractSyllabus);
// Generation Engine
router.post('/generate', requireStaffOrAdmin, question_generator_controller_js_1.generatePaper);
router.post('/regenerate-question', requireStaffOrAdmin, question_generator_controller_js_1.regenerateQuestion);
// Saved Papers CRUD
router.get('/papers', requireStaffOrAdmin, question_generator_controller_js_1.listPapers);
router.post('/papers', requireStaffOrAdmin, question_generator_controller_js_1.savePaper);
router.get('/papers/:id', requireStaffOrAdmin, question_generator_controller_js_1.getPaperById);
router.delete('/papers/:id', requireStaffOrAdmin, question_generator_controller_js_1.deletePaper);
router.post('/papers/:id/duplicate', requireStaffOrAdmin, question_generator_controller_js_1.duplicatePaper);
// Answer Key (Strictly restricted to Staff / Admin)
router.get('/papers/:id/answer-key', requireStaffOrAdmin, question_generator_controller_js_1.getAnswerKey);
exports.default = router;
