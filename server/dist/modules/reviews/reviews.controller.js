"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateReviewStatusSchema = exports.replyReviewSchema = exports.createReviewSchema = void 0;
exports.createReview = createReview;
exports.listReviews = listReviews;
exports.replyToReview = replyToReview;
exports.updateReviewStatus = updateReviewStatus;
const prisma_js_1 = require("../../prisma.js");
const zod_1 = require("zod");
const inapp_notification_service_js_1 = require("../notifications/inapp-notification.service.js");
exports.createReviewSchema = zod_1.z.object({
    type: zod_1.z.enum(['FEEDBACK', 'TESTIMONIAL']).default('FEEDBACK'),
    studentId: zod_1.z.string().uuid().optional().nullable(),
    staffId: zod_1.z.string().uuid().optional().nullable(),
    subject: zod_1.z.string().max(150).optional().nullable(),
    category: zod_1.z.enum(['GENERAL', 'ACADEMIC', 'FACILITIES', 'SCHEDULE', 'BEHAVIOR', 'BILLING']).default('GENERAL'),
    rating: zod_1.z.union([zod_1.z.number(), zod_1.z.string().transform((v) => parseInt(v, 10))]).optional().nullable(),
    reviewText: zod_1.z.string().min(5, 'Review / feedback message must be at least 5 characters').max(2000),
    isPublicConsent: zod_1.z.union([zod_1.z.boolean(), zod_1.z.string().transform((v) => v === 'true' || v === '1')]).optional().default(false),
}).refine((data) => {
    if (data.type === 'TESTIMONIAL') {
        return data.rating !== undefined && data.rating !== null && data.rating >= 1 && data.rating <= 5;
    }
    return true;
}, {
    message: 'Rating (1 to 5 stars) is required when submitting a testimonial',
    path: ['rating'],
}).refine((data) => {
    if (data.type === 'TESTIMONIAL') {
        return data.isPublicConsent === true;
    }
    return true;
}, {
    message: 'Explicit consent for public display is required for testimonials',
    path: ['isPublicConsent'],
});
exports.replyReviewSchema = zod_1.z.object({
    replyText: zod_1.z.string().min(2, 'Reply text is required').max(2000),
    status: zod_1.z.enum(['REPLIED', 'RESOLVED']).optional().default('REPLIED'),
});
exports.updateReviewStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['NEW', 'REPLIED', 'RESOLVED', 'PENDING', 'APPROVED', 'PUBLISHED', 'ARCHIVED', 'REJECTED']),
});
/**
 * Submit parent private feedback or public testimonial
 */
async function createReview(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        if (req.user?.role !== 'PARENT') {
            return res.status(403).json({ success: false, error: 'Only registered parents can submit reviews or feedback' });
        }
        const parse = exports.createReviewSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: parse.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
            });
        }
        const data = parse.data;
        // Verify parent profile exists
        const parentProfile = await prisma_js_1.prisma.parentProfile.findFirst({
            where: { userId: req.user.userId },
        });
        if (!parentProfile) {
            return res.status(404).json({ success: false, error: 'Parent profile not found' });
        }
        // If studentId provided, verify parent is linked to this student
        if (data.studentId) {
            const relation = await prisma_js_1.prisma.studentParentRelation.findFirst({
                where: {
                    studentId: data.studentId,
                    parentId: parentProfile.id,
                },
                include: { student: true },
            });
            if (!relation || relation.student.instituteId !== instituteId) {
                return res.status(403).json({ success: false, error: 'Forbidden: You are not linked to this student' });
            }
        }
        const isTestimonial = data.type === 'TESTIMONIAL';
        // Testimonials start in PENDING (never auto-published)
        // Private feedback starts in NEW
        const initialStatus = isTestimonial ? 'PENDING' : 'NEW';
        const review = await prisma_js_1.prisma.parentReview.create({
            data: {
                instituteId,
                parentId: parentProfile.id,
                studentId: data.studentId || null,
                staffId: data.staffId || null,
                type: data.type,
                subject: data.subject?.trim() || (isTestimonial ? 'Parent Testimonial' : 'Parent Feedback'),
                category: data.category,
                rating: data.rating || null,
                reviewText: data.reviewText.trim(),
                isPublicConsent: isTestimonial ? true : false,
                isPublished: false, // Never auto-published!
                status: initialStatus,
            },
            include: {
                parent: { include: { user: { select: { fullName: true, phone: true } } } },
                student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
            },
        });
        await prisma_js_1.prisma.auditLog.create({
            data: {
                instituteId,
                userId: req.user.userId,
                action: isTestimonial ? 'SUBMIT_PARENT_TESTIMONIAL' : 'SUBMIT_PARENT_FEEDBACK',
                entityType: 'ParentReview',
                entityId: review.id,
                newValues: {
                    type: data.type,
                    studentId: data.studentId,
                    rating: data.rating,
                    status: initialStatus,
                },
            },
        });
        return res.status(201).json({
            success: true,
            message: isTestimonial
                ? 'Thank you! Your testimonial has been submitted for administrative review.'
                : 'Your private feedback has been logged. Faculty / Administration will review and respond shortly.',
            data: { review },
        });
    }
    catch (err) {
        console.error('[Create Review Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to submit review' });
    }
}
/**
 * List parent reviews and feedback
 */
async function listReviews(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const type = req.query.type; // 'FEEDBACK', 'TESTIMONIAL', 'ALL'
        const status = req.query.status;
        const studentId = req.query.studentId;
        const category = req.query.category;
        const where = { instituteId };
        if (type && type !== 'ALL') {
            where.type = type;
        }
        if (status) {
            where.status = status;
        }
        if (category) {
            where.category = category;
        }
        if (studentId) {
            where.studentId = studentId;
        }
        if (req.user?.role === 'PARENT') {
            const parentProfile = await prisma_js_1.prisma.parentProfile.findFirst({
                where: { userId: req.user.userId },
            });
            if (!parentProfile)
                return res.json({ success: true, data: { reviews: [] } });
            // Parents see their own feedback/reviews, OR published public testimonials
            where.OR = [
                { parentId: parentProfile.id },
                { type: 'TESTIMONIAL', isPublished: true },
            ];
        }
        else if (req.user?.role === 'STUDENT') {
            // Students are strictly forbidden from accessing private parent inquiries
            if (type === 'FEEDBACK' || type === 'ALL') {
                return res.status(403).json({
                    success: false,
                    error: 'Forbidden: Student accounts cannot access private parent inquiries',
                });
            }
            // If studentId parameter was supplied, verify it matches the authenticated student
            if (studentId) {
                const student = await prisma_js_1.prisma.student.findFirst({
                    where: { userId: req.user.userId, instituteId },
                    select: { id: true },
                });
                if (!student || student.id !== studentId) {
                    return res.status(403).json({
                        success: false,
                        error: 'Forbidden: You can only query your own records',
                    });
                }
            }
            // Students can only access approved, published public testimonials
            where.type = 'TESTIMONIAL';
            where.isPublished = true;
        }
        const reviews = await prisma_js_1.prisma.parentReview.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                parent: { include: { user: { select: { fullName: true, phone: true } } } },
                student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
                staff: { select: { id: true, fullName: true } },
            },
        });
        return res.json({
            success: true,
            data: { reviews },
        });
    }
    catch (err) {
        console.error('[List Reviews Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to list reviews' });
    }
}
/**
 * Staff / Admin reply to a parent feedback or review
 */
async function replyToReview(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params;
        const parse = exports.replyReviewSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const review = await prisma_js_1.prisma.parentReview.findFirst({
            where: { id, instituteId },
        });
        if (!review)
            return res.status(404).json({ success: false, error: 'Review or feedback inquiry not found' });
        const newStatus = parse.data.status || 'REPLIED';
        const updated = await prisma_js_1.prisma.parentReview.update({
            where: { id },
            data: {
                replyText: parse.data.replyText.trim(),
                repliedAt: new Date(),
                repliedById: req.user.userId,
                status: newStatus,
                staffId: req.user.userId,
            },
            include: {
                parent: { include: { user: { select: { fullName: true } } } },
                student: { select: { id: true, firstName: true, lastName: true } },
                staff: { select: { id: true, fullName: true } },
            },
        });
        // Notify parent about the faculty response
        inapp_notification_service_js_1.InAppNotificationService.notifyParentFeedbackReplied(updated.id).catch((err) => {
            console.error('[Notification dispatch error]', err);
        });
        await prisma_js_1.prisma.auditLog.create({
            data: {
                instituteId,
                userId: req.user.userId,
                action: 'REPLY_PARENT_REVIEW',
                entityType: 'ParentReview',
                entityId: id,
                newValues: { status: newStatus },
            },
        });
        return res.json({
            success: true,
            message: 'Reply sent and parent notified',
            data: { review: updated },
        });
    }
    catch (err) {
        console.error('[Reply Review Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to send reply' });
    }
}
/**
 * Update review status (Moderation & publishing for testimonials / status change for feedback)
 */
async function updateReviewStatus(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params;
        const parse = exports.updateReviewStatusSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Valid status required' });
        }
        const review = await prisma_js_1.prisma.parentReview.findFirst({
            where: { id, instituteId },
        });
        if (!review)
            return res.status(404).json({ success: false, error: 'Review not found' });
        const targetStatus = parse.data.status;
        let isPublished = review.isPublished;
        // Safety rule: Private feedback is NEVER publicly published
        if (review.type === 'FEEDBACK') {
            isPublished = false;
            if (['APPROVED', 'PUBLISHED'].includes(targetStatus)) {
                return res.status(400).json({
                    success: false,
                    error: 'Private feedback cannot be published as a public testimonial.',
                });
            }
        }
        else {
            // Testimonial moderation
            if (targetStatus === 'PUBLISHED' || targetStatus === 'APPROVED') {
                if (!review.isPublicConsent) {
                    return res.status(400).json({
                        success: false,
                        error: 'Cannot publish testimonial without explicit parent consent.',
                    });
                }
                isPublished = true;
            }
            else if (['ARCHIVED', 'REJECTED', 'PENDING'].includes(targetStatus)) {
                isPublished = false;
            }
        }
        const updated = await prisma_js_1.prisma.parentReview.update({
            where: { id },
            data: {
                status: targetStatus,
                isPublished,
            },
            include: {
                parent: { include: { user: { select: { fullName: true } } } },
                student: { select: { id: true, firstName: true, lastName: true } },
            },
        });
        await prisma_js_1.prisma.auditLog.create({
            data: {
                instituteId,
                userId: req.user.userId,
                action: 'UPDATE_PARENT_REVIEW_STATUS',
                entityType: 'ParentReview',
                entityId: id,
                newValues: { status: targetStatus, isPublished },
            },
        });
        return res.json({
            success: true,
            message: `Status updated to ${targetStatus}`,
            data: { review: updated },
        });
    }
    catch (err) {
        console.error('[Update Review Status Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to update review status' });
    }
}
