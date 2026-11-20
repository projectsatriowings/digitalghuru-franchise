"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.requireRole = requireRole;
exports.requireInstituteContext = requireInstituteContext;
const security_js_1 = require("../utils/security.js");
const prisma_js_1 = require("../prisma.js");
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    // Also accept token from query parameter (for media/image streaming where browsers and <img> tags cannot attach Authorization headers)
    if (!token && req.query.token) {
        token = req.query.token;
    }
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Authentication token required',
            timestamp: new Date().toISOString(),
        });
    }
    const payload = (0, security_js_1.verifyAccessToken)(token);
    if (!payload) {
        return res.status(401).json({
            success: false,
            error: 'Invalid or expired authentication token',
            timestamp: new Date().toISOString(),
        });
    }
    req.user = payload;
    const headerInst = req.headers['x-institute-id'];
    const queryInst = (req.query.instituteId || req.query.inst);
    req.instituteId = payload.instituteId || headerInst || queryInst || undefined;
    next();
}
function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                timestamp: new Date().toISOString(),
            });
        }
        // BRANCH_ADMIN and FRANCHISE_OWNER inherit ACADEMIC_ADMIN privileges within their assigned franchise branch
        const effectiveRoles = [req.user.role];
        if (req.user.role === 'BRANCH_ADMIN' || req.user.role === 'FRANCHISE_OWNER') {
            effectiveRoles.push('ACADEMIC_ADMIN');
        }
        const hasPermission = allowedRoles.some((role) => effectiveRoles.includes(role));
        if (!hasPermission) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Insufficient privileges for this operation',
                timestamp: new Date().toISOString(),
            });
        }
        next();
    };
}
async function requireInstituteContext(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    // Super Admins have platform-level access
    if (req.user.role === 'SUPER_ADMIN') {
        const requestedInstituteId = req.headers['x-institute-id'] || req.query.instituteId;
        if (requestedInstituteId) {
            req.instituteId = requestedInstituteId;
        }
        return next();
    }
    // Franchisee Admin (FRANCHISE_OWNER) has access to all branches assigned to their franchise
    if (req.user.role === 'FRANCHISE_OWNER') {
        let instituteId = req.headers['x-institute-id'] || req.query.instituteId || req.user.instituteId;
        const userFranchise = await prisma_js_1.prisma.franchise.findFirst({
            where: { ownerUserId: req.user.userId },
            include: {
                branches: {
                    select: { id: true, code: true, name: true, status: true },
                    orderBy: { name: 'asc' },
                },
            },
        });
        if (!userFranchise || userFranchise.branches.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Institute context required: No campus branches currently assigned to your franchise center',
                timestamp: new Date().toISOString(),
            });
        }
        const assignedBranchIds = userFranchise.branches.map((b) => b.id);
        req.franchiseId = userFranchise.id;
        req.assignedBranchIds = assignedBranchIds;
        // Handle 'ALL' (Consolidated Mode)
        if (instituteId === 'ALL' || instituteId === 'all') {
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
                return res.status(400).json({
                    success: false,
                    error: 'Please select a specific campus branch from the branch selector to perform this operation',
                    timestamp: new Date().toISOString(),
                });
            }
            // For safe read-only routes, default to first assigned branch so downstream queries receive a valid UUID
            req.instituteId = assignedBranchIds[0];
            return next();
        }
        // Default to first branch if none explicitly specified
        if (!instituteId) {
            req.instituteId = assignedBranchIds[0];
            return next();
        }
        // Verify requested branch strictly belongs to this Franchisee Admin
        if (assignedBranchIds.includes(instituteId)) {
            req.instituteId = instituteId;
            return next();
        }
        return res.status(403).json({
            success: false,
            error: 'Forbidden: You do not have authorization to access this campus branch',
            timestamp: new Date().toISOString(),
        });
    }
    // For institute-bound roles, verify active membership
    let instituteId = req.headers['x-institute-id'] || req.query.instituteId || req.user.instituteId;
    if (!instituteId) {
        const fallbackMembership = await prisma_js_1.prisma.instituteMembership.findFirst({
            where: { userId: req.user.userId, isActive: true },
            select: { instituteId: true },
        });
        if (fallbackMembership) {
            instituteId = fallbackMembership.instituteId;
        }
        else {
            const studentProfile = await prisma_js_1.prisma.student.findFirst({
                where: { userId: req.user.userId, status: 'ACTIVE' },
                select: { instituteId: true },
            });
            if (studentProfile) {
                instituteId = studentProfile.instituteId;
            }
        }
    }
    if (!instituteId) {
        return res.status(400).json({
            success: false,
            error: 'Institute context required',
            timestamp: new Date().toISOString(),
        });
    }
    try {
        const membership = await prisma_js_1.prisma.instituteMembership.findUnique({
            where: {
                instituteId_userId: {
                    instituteId,
                    userId: req.user.userId,
                },
            },
            include: {
                institute: true,
            },
        });
        if (!membership || !membership.isActive || membership.institute.status !== 'ACTIVE') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Active institute membership required',
                timestamp: new Date().toISOString(),
            });
        }
        req.instituteId = instituteId;
        next();
    }
    catch (err) {
        return res.status(500).json({
            success: false,
            error: 'Error validating institute context',
            timestamp: new Date().toISOString(),
        });
    }
}
