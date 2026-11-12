import { Router } from 'express';
import {
  listStudents,
  admitStudent,
  getAdmissionPrefixInfo,
  getStudentById,
  getMyStudentProfile,
  updateStudent,
  updateStudentStatus,
  updateStudentAccountStatus,
  resetStudentPassword,
  updateStudentLoginIdentifier,
  uploadStudentPhoto,
  getStudentPhoto,
  getRawPhoto,
  lookupParent,
  assignStudentBatch,
  lookupExistingStudent,
  enrollExistingStudent,
} from './students.controller.js';
import { authenticateToken, requireRole, requireInstituteContext, AuthenticatedRequest } from '../../middleware/auth.js';
import { prisma } from '../../prisma.js';
import { fileUpload, photoUpload } from '../../utils/storage.js';

const requireStudentModuleContext = async (req: AuthenticatedRequest, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (req.user.role === 'SUPER_ADMIN') {
    const requestedInst = (req.headers['x-institute-id'] as string) || (req.query.instituteId as string);
    req.instituteId = requestedInst && requestedInst !== 'ALL' && requestedInst !== 'all' ? requestedInst : undefined;
    const requestedFranchise = (req.headers['x-franchise-id'] as string) || (req.query.franchiseId as string) || (req.body?.franchiseId as string);
    if (requestedFranchise) req.franchiseId = requestedFranchise;
    return next();
  }

  if (req.user.role === 'FRANCHISE_OWNER') {
    const userFranchise = await prisma.franchise.findFirst({
      where: { ownerUserId: req.user.userId },
      include: {
        branches: {
          select: { id: true, code: true, name: true, status: true },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!userFranchise) {
      return res.status(400).json({ success: false, error: 'Franchise profile not found for your account' });
    }
    const assignedBranchIds = userFranchise.branches.map((b) => b.id);
    req.franchiseId = userFranchise.id;
    (req as any).assignedBranchIds = assignedBranchIds;

    const rawInst = (req.headers['x-institute-id'] as string) || (req.query.instituteId as string) || req.user.instituteId;
    if (rawInst === 'ALL' || rawInst === 'all') {
      (req as any).isConsolidatedBranchView = true;
      req.instituteId = undefined;
      return next();
    }
    if (!rawInst) {
      req.instituteId = assignedBranchIds[0] || undefined;
      if (!req.instituteId) {
        (req as any).isConsolidatedBranchView = true;
      }
      return next();
    }
    if (!assignedBranchIds.includes(rawInst)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have authorization to access this campus branch',
      });
    }
    req.instituteId = rawInst;
    return next();
  }

  if (req.user.role === 'PARENT' || req.user.role === 'STUDENT') {
    return next();
  }

  return requireInstituteContext(req, res, next);
};

const handlePhotoUpload = (req: any, res: any, next: any) => {
  photoUpload.single('photo')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'Photo file size exceeds maximum limit of 5MB' });
      }
      return res.status(400).json({ success: false, error: err.message || 'Invalid photo file upload' });
    }
    next();
  });
};

const router = Router();

router.use(authenticateToken);

// Photograph streaming routes (accessible via <img> tags with query token ?token=...)
router.get('/:id/photo', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), getStudentPhoto);
router.get('/photo-raw/:key', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), getRawPhoto);
router.get('/my/profile', requireRole('STUDENT'), getMyStudentProfile);

router.use(requireStudentModuleContext);

// Student management routes
router.get('/admission-prefix', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), getAdmissionPrefixInfo);
router.get('/lookup', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), lookupExistingStudent);
router.get('/lookup-parent', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), lookupParent);
router.get('/', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), listStudents);
router.post('/', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), admitStudent);
router.post('/:id/enroll', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), enrollExistingStudent);

// Photograph upload routes
router.post('/upload-photo', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), handlePhotoUpload, uploadStudentPhoto);
router.post('/:id/photo', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), handlePhotoUpload, uploadStudentPhoto);

router.get('/:id', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), getStudentById);
router.patch('/:id', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), updateStudent);
router.put('/:id', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), updateStudent);
router.put('/:id/batch-assignment', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), assignStudentBatch);
router.patch('/:id/status', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), updateStudentStatus);

import {
  allocateStudentSubjects,
  getStudentSubjectAllocations,
} from '../academics/academics.controller.js';

// Student Subject Allocations
router.get('/:id/subject-allocations', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), getStudentSubjectAllocations);
router.post('/:id/subject-allocations', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), allocateStudentSubjects);

// Student credential management routes
router.post('/:id/reset-password', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), resetStudentPassword);
router.patch('/:id/account-identifier', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), updateStudentLoginIdentifier);
router.patch('/:id/account-status', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), updateStudentAccountStatus);

export default router;

