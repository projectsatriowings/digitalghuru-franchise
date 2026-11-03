import { Router } from 'express';
import {
  createMaterial,
  listMaterials,
  getMaterialById,
  updateMaterial,
  deleteMaterial,
  downloadMaterial,
  trackMaterialInteraction,
  getMaterialInteractions,
} from './materials.controller.js';
import { authenticateToken, requireRole, requireInstituteContext } from '../../middleware/auth.js';
import { fileUpload } from '../../utils/storage.js';

const router = Router();

router.use(authenticateToken);
router.use(requireInstituteContext);

// Material routes
router.get('/', listMaterials);
router.post(
  '/',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  fileUpload.single('file'),
  createMaterial
);
router.get('/:id', getMaterialById);
router.patch(
  '/:id',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  updateMaterial
);
router.delete(
  '/:id',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  deleteMaterial
);
router.get('/:id/download', downloadMaterial);

router.post('/:id/track', trackMaterialInteraction);
router.post('/:id/interactions', trackMaterialInteraction);
router.get('/:id/interactions', getMaterialInteractions);


export default router;
