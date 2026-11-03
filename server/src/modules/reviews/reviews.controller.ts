import { Response } from 'express';
import { prisma } from '../../prisma.js';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { InAppNotificationService } from '../notifications/inapp-notification.service.js';

export const createReviewSchema = z.object({
  type: z.enum(['FEEDBACK', 'TESTIMONIAL']).default('FEEDBACK'),
  studentId: z.string().uuid().optional().nullable(),
  staffId: z.string().uuid().optional().nullable(),
  subject: z.string().max(150).optional().nullable(),
  category: z.enum(['GENERAL', 'ACADEMIC', 'FACILITIES', 'SCHEDULE', 'BEHAVIOR', 'BILLING']).default('GENERAL'),
  rating: z.union([z.number(), z.string().transform((v) => parseInt(v, 10))]).optional().nullable(),
  reviewText: z.string().min(5, 'Review / feedback message must be at least 5 characters').max(2000),
  isPublicConsent: z.union([z.boolean(), z.string().transform((v) => v === 'true' || v === '1')]).optional().default(false),
}).refine(
  (data) => {
    if (data.type === 'TESTIMONIAL') {
      return data.rating !== undefined && data.rating !== null && data.rating >= 1 && data.rating <= 5;
    }
    return true;
  },
  {
    message: 'Rating (1 to 5 stars) is required when submitting a testimonial',
    path: ['rating'],
  }
).refine(
  (data) => {
    if (data.type === 'TESTIMONIAL') {
      return data.isPublicConsent === true;
    }
    return true;
  },
  {
    message: 'Explicit consent for public display is required for testimonials',
    path: ['isPublicConsent'],
  }
);

export const replyReviewSchema = z.object({
  replyText: z.string().min(2, 'Reply text is required').max(2000),
  status: z.enum(['REPLIED', 'RESOLVED']).optional().default('REPLIED'),
});

export const updateReviewStatusSchema = z.object({
  status: z.enum(['NEW', 'REPLIED', 'RESOLVED', 'PENDING', 'APPROVED', 'PUBLISHED', 'ARCHIVED', 'REJECTED']),
});

/**
 * Submit parent private feedback or public testimonial
 */
export async function createReview(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    if (req.user?.role !== 'PARENT') {
      return res.status(403).json({ success: false, error: 'Only registered parents can submit reviews or feedback' });
    }

    const parse = createReviewSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parse.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    const data = parse.data;

    // Verify parent profile exists
    const parentProfile = await prisma.parentProfile.findFirst({
      where: { userId: req.user.userId },
    });
    if (!parentProfile) {
      return res.status(404).json({ success: false, error: 'Parent profile not found' });
    }

    // If studentId provided, verify parent is linked to this student
    if (data.studentId) {
      const relation = await prisma.studentParentRelation.findFirst({
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

    const review = await prisma.parentReview.create({
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

    await prisma.auditLog.create({
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
  } catch (err: any) {
    console.error('[Create Review Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to submit review' });
  }
}

/**
 * List parent reviews and feedback
 */
export async function listReviews(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const type = req.query.type as string; // 'FEEDBACK', 'TESTIMONIAL', 'ALL'
    const status = req.query.status as string;
    const studentId = req.query.studentId as string;
    const category = req.query.category as string;

    const where: any = { instituteId };

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
      const parentProfile = await prisma.parentProfile.findFirst({
        where: { userId: req.user.userId },
      });
      if (!parentProfile) return res.json({ success: true, data: { reviews: [] } });

      // Parents see their own feedback/reviews, OR published public testimonials
      where.OR = [
        { parentId: parentProfile.id },
        { type: 'TESTIMONIAL', isPublished: true },
      ];
    } else if (req.user?.role === 'STUDENT') {
      // Students are strictly forbidden from accessing private parent inquiries
      if (type === 'FEEDBACK' || type === 'ALL') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Student accounts cannot access private parent inquiries',
        });
      }

      // If studentId parameter was supplied, verify it matches the authenticated student
      if (studentId) {
        const student = await prisma.student.findFirst({
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

    const reviews = await prisma.parentReview.findMany({
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
  } catch (err: any) {
    console.error('[List Reviews Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to list reviews' });
  }
}

/**
 * Staff / Admin reply to a parent feedback or review
 */
export async function replyToReview(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const parse = replyReviewSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
    }

    const review = await prisma.parentReview.findFirst({
      where: { id, instituteId },
    });
    if (!review) return res.status(404).json({ success: false, error: 'Review or feedback inquiry not found' });

    const newStatus = parse.data.status || 'REPLIED';

    const updated = await prisma.parentReview.update({
      where: { id },
      data: {
        replyText: parse.data.replyText.trim(),
        repliedAt: new Date(),
        repliedById: req.user!.userId,
        status: newStatus,
        staffId: req.user!.userId,
      },
      include: {
        parent: { include: { user: { select: { fullName: true } } } },
        student: { select: { id: true, firstName: true, lastName: true } },
        staff: { select: { id: true, fullName: true } },
      },
    });

    // Notify parent about the faculty response
    InAppNotificationService.notifyParentFeedbackReplied(updated.id).catch((err) => {
      console.error('[Notification dispatch error]', err);
    });

    await prisma.auditLog.create({
      data: {
        instituteId,
        userId: req.user!.userId,
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
  } catch (err: any) {
    console.error('[Reply Review Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to send reply' });
  }
}

/**
 * Update review status (Moderation & publishing for testimonials / status change for feedback)
 */
export async function updateReviewStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const parse = updateReviewStatusSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Valid status required' });
    }

    const review = await prisma.parentReview.findFirst({
      where: { id, instituteId },
    });
    if (!review) return res.status(404).json({ success: false, error: 'Review not found' });

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
    } else {
      // Testimonial moderation
      if (targetStatus === 'PUBLISHED' || targetStatus === 'APPROVED') {
        if (!review.isPublicConsent) {
          return res.status(400).json({
            success: false,
            error: 'Cannot publish testimonial without explicit parent consent.',
          });
        }
        isPublished = true;
      } else if (['ARCHIVED', 'REJECTED', 'PENDING'].includes(targetStatus)) {
        isPublished = false;
      }
    }

    const updated = await prisma.parentReview.update({
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

    await prisma.auditLog.create({
      data: {
        instituteId,
        userId: req.user!.userId,
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
  } catch (err: any) {
    console.error('[Update Review Status Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to update review status' });
  }
}
