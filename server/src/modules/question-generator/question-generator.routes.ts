import { Router } from 'express';
import {
  getConfig,
  validateBlueprint,
  extractSyllabus,
  generatePaper,
  regenerateQuestion,
  savePaper,
  listPapers,
  getPaperById,
  getAnswerKey,
  duplicatePaper,
  deletePaper,
} from './question-generator.controller.js';
import { authenticateToken, requireRole, requireInstituteContext } from '../../middleware/auth.js';
import { fileUpload } from '../../utils/storage.js';

const router = Router();

// Base protection: Must be authenticated and bound to active institute
router.use(authenticateToken);
router.use(requireInstituteContext);

// Strictly restrict paper generation and management to Staff and Administrators
const requireStaffOrAdmin = requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF');

// Configuration & Blueprint Validation
router.get('/config', requireStaffOrAdmin, getConfig);
router.post('/blueprint/validate', requireStaffOrAdmin, validateBlueprint);

// Syllabus Extraction
router.post('/extract-syllabus', requireStaffOrAdmin, fileUpload.single('file'), extractSyllabus);

// Generation Engine
router.post('/generate', requireStaffOrAdmin, generatePaper);
router.post('/regenerate-question', requireStaffOrAdmin, regenerateQuestion);

// Saved Papers CRUD
router.get('/papers', requireStaffOrAdmin, listPapers);
router.post('/papers', requireStaffOrAdmin, savePaper);
router.get('/papers/:id', requireStaffOrAdmin, getPaperById);
router.delete('/papers/:id', requireStaffOrAdmin, deletePaper);
router.post('/papers/:id/duplicate', requireStaffOrAdmin, duplicatePaper);

// Answer Key (Strictly restricted to Staff / Admin)
router.get('/papers/:id/answer-key', requireStaffOrAdmin, getAnswerKey);

export default router;
