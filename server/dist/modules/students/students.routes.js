"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const students_controller_js_1 = require("./students.controller.js");
const auth_js_1 = require("../../middleware/auth.js");
const prisma_js_1 = require("../../prisma.js");
const storage_js_1 = require("../../utils/storage.js");
const requireStudentModuleContext = async (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    if (req.user.role === 'SUPER_ADMIN') {
        const requestedInst = req.headers['x-institute-id'] || req.query.instituteId;
        req.instituteId = requestedInst && requestedInst !== 'ALL' && requestedInst !== 'all' ? requestedInst : undefined;
        const requestedFranchise = req.headers['x-franchise-id'] || req.query.franchiseId || req.body?.franchiseId;
        if (requestedFranchise)
            req.franchiseId = requestedFranchise;
        return next();
    }
    if (req.user.role === 'FRANCHISE_OWNER') {
        const userFranchise = await prisma_js_1.prisma.franchise.findFirst({
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
        req.assignedBranchIds = assignedBranchIds;
        const rawInst = req.headers['x-institute-id'] || req.query.instituteId || req.user.instituteId;
        if (rawInst === 'ALL' || rawInst === 'all') {
            req.isConsolidatedBranchView = true;
            req.instituteId = undefined;
            return next();
        }
        if (!rawInst) {
            req.instituteId = assignedBranchIds[0] || undefined;
            if (!req.instituteId) {
                req.isConsolidatedBranchView = true;
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
    return (0, auth_js_1.requireInstituteContext)(req, res, next);
};
const handlePhotoUpload = (req, res, next) => {
    storage_js_1.photoUpload.single('photo')(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ success: false, error: 'Photo file size exceeds maximum limit of 5MB' });
            }
            return res.status(400).json({ success: false, error: err.message || 'Invalid photo file upload' });
        }
        next();
    });
};
const router = (0, express_1.Router)();
router.use(auth_js_1.authenticateToken);
// Photograph streaming routes (accessible via <img> tags with query token ?token=...)
router.get('/:id/photo', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), students_controller_js_1.getStudentPhoto);
router.get('/photo-raw/:key', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), students_controller_js_1.getRawPhoto);
router.get('/my/profile', (0, auth_js_1.requireRole)('STUDENT'), students_controller_js_1.getMyStudentProfile);
router.use(requireStudentModuleContext);
// Student management routes
router.get('/admission-prefix', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), students_controller_js_1.getAdmissionPrefixInfo);
router.get('/lookup', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), students_controller_js_1.lookupExistingStudent);
router.get('/lookup-parent', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), students_controller_js_1.lookupParent);
router.get('/', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), students_controller_js_1.listStudents);
router.post('/', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), students_controller_js_1.admitStudent);
router.post('/:id/enroll', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), students_controller_js_1.enrollExistingStudent);
// Photograph upload routes
router.post('/upload-photo', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), handlePhotoUpload, students_controller_js_1.uploadStudentPhoto);
router.post('/:id/photo', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), handlePhotoUpload, students_controller_js_1.uploadStudentPhoto);
router.get('/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), students_controller_js_1.getStudentById);
router.patch('/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), students_controller_js_1.updateStudent);
router.put('/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), students_controller_js_1.updateStudent);
router.put('/:id/batch-assignment', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), students_controller_js_1.assignStudentBatch);
router.patch('/:id/status', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), students_controller_js_1.updateStudentStatus);
const academics_controller_js_1 = require("../academics/academics.controller.js");
// Student Subject Allocations
router.get('/:id/subject-allocations', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), academics_controller_js_1.getStudentSubjectAllocations);
router.post('/:id/subject-allocations', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.allocateStudentSubjects);
// Student credential management routes
router.post('/:id/reset-password', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), students_controller_js_1.resetStudentPassword);
router.patch('/:id/account-identifier', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), students_controller_js_1.updateStudentLoginIdentifier);
router.patch('/:id/account-status', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'STAFF'), students_controller_js_1.updateStudentAccountStatus);
exports.default = router;
