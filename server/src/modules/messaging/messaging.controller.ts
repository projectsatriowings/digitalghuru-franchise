import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import { prisma } from '../../prisma.js';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { getAuthorizedStudentScope } from '../students/student-authorization.service.js';
import { InAppNotificationService } from '../notifications/inapp-notification.service.js';
import {
  resolveAbsolutePath,
  getRelativeStorageKey,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../../utils/storage.js';

export const startConversationSchema = z.object({
  recipientUserId: z.string().uuid('Valid recipient user ID required'),
  studentId: z.string().uuid('Valid student ID required').optional().nullable(),
  title: z.string().max(100).optional().nullable(),
});

export const sendMessageSchema = z.object({
  body: z.string().max(3000).default(''),
  attachmentUrl: z.string().optional().nullable(),
  attachmentType: z.enum(['IMAGE', 'AUDIO', 'DOCUMENT']).optional().nullable(),
  attachmentName: z.string().max(255).optional().nullable(),
  attachmentSize: z.number().int().nonnegative().optional().nullable(),
  clientTempId: z.string().max(100).optional().nullable(),
}).refine((data) => data.body.trim().length > 0 || !!data.attachmentUrl, {
  message: 'Message must include either text body or attachment',
});

/**
 * List conversations for the logged in user with full student, parent, batch and unread status
 */
export async function listUserConversations(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const currentUserId = req.user!.userId;
    const userRole = req.user!.role;

    // Students are not permitted to access staff-parent private communication
    if (userRole === 'STUDENT') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Students are not authorized to view parent-teacher communications.',
      });
    }

    const search = (req.query.search as string || '').trim();
    const filter = (req.query.filter as string || 'ALL').toUpperCase(); // ALL, UNREAD, READ

    // Base query: conversations where the current user is a member
    let whereClause: any = {
      instituteId,
      members: { some: { userId: currentUserId } },
    };

    // Role-specific scoping:
    if (userRole === 'STAFF') {
      const scope = await getAuthorizedStudentScope(req, prisma);
      whereClause.OR = [
        // Conversations associated with a student in staff's scope
        {
          student: {
            ...scope.whereClause,
          },
        },
        // General staff conversations without a student link
        { studentId: null },
      ];
    } else if (userRole === 'PARENT') {
      // Find children linked to this parent
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: currentUserId },
        select: {
          id: true,
          studentRelations: { select: { studentId: true } },
        },
      });

      const allowedStudentIds = parentProfile?.studentRelations.map((sr) => sr.studentId) || [];
      whereClause.OR = [
        { studentId: { in: allowedStudentIds } },
        { studentId: null },
      ];
    }

    const conversations = await prisma.conversation.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            photoUrl: true,
            enrollments: {
              where: { isActive: true },
              take: 1,
              select: {
                batch: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
        members: {
          include: {
            user: { select: { id: true, fullName: true, role: true, phone: true, email: true } },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { sender: { select: { id: true, fullName: true, role: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Compute unread counts and enrich items
    const formatted = await Promise.all(
      conversations.map(async (conv) => {
        const otherMembers = conv.members.filter((m) => m.userId !== currentUserId);
        const myMembership = conv.members.find((m) => m.userId === currentUserId);
        const lastMessage = conv.messages[0] || null;

        // Count unread messages for this user in this conversation
        let unreadCount = 0;
        if (myMembership?.lastReadAt) {
          unreadCount = await prisma.message.count({
            where: {
              conversationId: conv.id,
              senderId: { not: currentUserId },
              createdAt: { gt: myMembership.lastReadAt },
            },
          });
        } else {
          unreadCount = await prisma.message.count({
            where: {
              conversationId: conv.id,
              senderId: { not: currentUserId },
            },
          });
        }

        const isUnread = unreadCount > 0;
        const otherUser = otherMembers[0]?.user || null;

        // If other user is parent, identify them
        const parentUser = conv.members.find((m) => m.user.role === 'PARENT')?.user || (otherUser?.role === 'PARENT' ? otherUser : null);

        const studentData = conv.student ? {
          id: conv.student.id,
          firstName: conv.student.firstName,
          lastName: conv.student.lastName,
          fullName: `${conv.student.firstName} ${conv.student.lastName}`.trim(),
          admissionNumber: conv.student.admissionNumber,
          photoUrl: conv.student.photoUrl,
          batch: conv.student.enrollments?.[0]?.batch || null,
        } : null;

        return {
          id: conv.id,
          title: conv.title || (studentData ? `Regarding ${studentData.fullName}` : otherUser?.fullName || 'Direct Conversation'),
          isGroup: conv.isGroup,
          studentId: conv.studentId,
          student: studentData,
          batch: studentData?.batch || null,
          parent: parentUser ? {
            id: parentUser.id,
            fullName: parentUser.fullName,
            phone: parentUser.phone,
            email: parentUser.email,
          } : null,
          otherUser: otherUser ? {
            id: otherUser.id,
            fullName: otherUser.fullName,
            role: otherUser.role,
          } : null,
          lastMessage: lastMessage ? {
            id: lastMessage.id,
            body: lastMessage.body,
            attachmentUrl: lastMessage.attachmentUrl,
            attachmentType: lastMessage.attachmentType,
            attachmentName: lastMessage.attachmentName,
            senderId: lastMessage.senderId,
            senderName: lastMessage.sender.fullName,
            senderRole: lastMessage.sender.role,
            createdAt: lastMessage.createdAt,
          } : null,
          unreadCount,
          isUnread,
          updatedAt: conv.updatedAt,
          createdAt: conv.createdAt,
        };
      })
    );

    // Apply search and read/unread filters
    let results = formatted;

    if (search) {
      const q = search.toLowerCase();
      results = results.filter((c) =>
        c.student?.fullName?.toLowerCase().includes(q) ||
        c.student?.admissionNumber?.toLowerCase().includes(q) ||
        c.parent?.fullName?.toLowerCase().includes(q) ||
        c.otherUser?.fullName?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        c.lastMessage?.body?.toLowerCase().includes(q)
      );
    }

    if (filter === 'UNREAD') {
      results = results.filter((c) => c.isUnread);
    } else if (filter === 'READ') {
      results = results.filter((c) => !c.isUnread);
    }

    return res.json({ success: true, data: { conversations: results } });
  } catch (err: any) {
    console.error('[List Conversations Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to list conversations' });
  }
}

/**
 * Start or retrieve existing 1-on-1 conversation associated with student
 */
export async function getOrCreateConversation(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const currentUserId = req.user!.userId;
    const userRole = req.user!.role;

    if (userRole === 'STUDENT') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Students cannot create parent-staff conversations.',
      });
    }

    const parse = startConversationSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
    }

    const { recipientUserId, studentId, title } = parse.data;

    if (recipientUserId === currentUserId) {
      return res.status(400).json({ success: false, error: 'Cannot start conversation with yourself' });
    }

    // Verify recipient user
    const recipientUser = await prisma.user.findFirst({
      where: { id: recipientUserId, isActive: true },
      select: { id: true, fullName: true, role: true },
    });
    if (!recipientUser) {
      return res.status(404).json({ success: false, error: 'Recipient user not found or inactive' });
    }

    // Authorization checks based on roles and student
    let verifiedStudentId: string | null = null;

    if (studentId) {
      const student = await prisma.student.findFirst({
        where: { id: studentId, instituteId },
        include: {
          parentRelations: {
            include: { parent: { select: { userId: true } } },
          },
          enrollments: {
            where: { isActive: true },
            select: { batchId: true },
          },
        },
      });

      if (!student) {
        return res.status(404).json({ success: false, error: 'Student not found in this institute' });
      }

      if (userRole === 'PARENT') {
        // Parent must be linked to this student
        const isLinkedParent = student.parentRelations.some((pr) => pr.parent.userId === currentUserId);
        if (!isLinkedParent) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: You are not authorized to start a conversation regarding this student.',
          });
        }
      } else if (userRole === 'STAFF') {
        // Staff must have assignment to student's batch or subject
        const studentBatchIds = student.enrollments.map((e) => e.batchId);
        const hasAssignment = await prisma.staffBatchAssignment.findFirst({
          where: {
            batchId: { in: studentBatchIds },
            staffProfile: { userId: currentUserId },
          },
        });
        if (!hasAssignment) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: You are not assigned to this student’s batch.',
          });
        }
      }

      verifiedStudentId = student.id;
    }

    // Check if 1-on-1 conversation already exists between these 2 users for this student (or general)
    const existing = await prisma.conversation.findFirst({
      where: {
        instituteId,
        isGroup: false,
        studentId: verifiedStudentId,
        AND: [
          { members: { some: { userId: currentUserId } } },
          { members: { some: { userId: recipientUserId } } },
        ],
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            photoUrl: true,
            enrollments: {
              where: { isActive: true },
              take: 1,
              select: { batch: { select: { id: true, name: true } } },
            },
          },
        },
        members: { include: { user: { select: { id: true, fullName: true, role: true } } } },
      },
    });

    if (existing) {
      return res.json({
        success: true,
        message: 'Existing conversation retrieved',
        data: { conversation: existing },
      });
    }

    // Create new conversation with both members
    const conversation = await prisma.conversation.create({
      data: {
        instituteId,
        studentId: verifiedStudentId,
        title: title?.trim() || null,
        isGroup: false,
        members: {
          create: [
            { userId: currentUserId },
            { userId: recipientUserId },
          ],
        },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            photoUrl: true,
            enrollments: {
              where: { isActive: true },
              take: 1,
              select: { batch: { select: { id: true, name: true } } },
            },
          },
        },
        members: { include: { user: { select: { id: true, fullName: true, role: true } } } },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Conversation started successfully',
      data: { conversation },
    });
  } catch (err: any) {
    console.error('[Start Conversation Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to initiate conversation' });
  }
}

/**
 * Get messages in a conversation with pagination
 */
export async function getConversationMessages(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id: conversationId } = req.params;
    const currentUserId = req.user!.userId;
    const userRole = req.user!.role;

    if (userRole === 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // Verify user is a member of this conversation in this institute
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUserId,
        },
      },
      include: { conversation: { include: { student: true } } },
    });

    if (!member || member.conversation.instituteId !== instituteId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You are not a member of this conversation' });
    }

    // Role-based student check
    if (userRole === 'STAFF' && member.conversation.studentId) {
      const scope = await getAuthorizedStudentScope(req, prisma);
      const isAuthorized = await prisma.student.findFirst({
        where: {
          id: member.conversation.studentId,
          ...scope.whereClause,
        },
      });
      if (!isAuthorized) {
        return res.status(403).json({ success: false, error: 'Forbidden: Student is outside your authorized scope' });
      }
    }

    // Update lastReadAt for read tracking
    await prisma.conversationMember.update({
      where: { id: member.id },
      data: { lastReadAt: new Date() },
    });

    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '50', 10)));
    const skip = (page - 1) * limit;

    const [total, rawMessages] = await Promise.all([
      prisma.message.count({ where: { conversationId } }),
      prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        include: {
          sender: { select: { id: true, fullName: true, role: true } },
        },
      }),
    ]);

    const messages = rawMessages.map((m) => ({
      ...m,
      isMine: m.senderId === currentUserId,
    }));

    return res.json({
      success: true,
      data: {
        messages,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err: any) {
    console.error('[Get Messages Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
}

/**
 * Send a message in a conversation (text and/or attachment)
 */
export async function sendMessage(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id: conversationId } = req.params;
    const currentUserId = req.user!.userId;
    const userRole = req.user!.role;

    if (userRole === 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const parse = sendMessageSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.errors[0]?.message || 'Validation failed' });
    }

    // Verify membership
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUserId,
        },
      },
      include: {
        conversation: {
          include: {
            members: { include: { user: { select: { id: true, fullName: true, role: true } } } },
          },
        },
      },
    });

    if (!member || member.conversation.instituteId !== instituteId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot post in this conversation' });
    }

    const data = parse.data;

    // Deduplication check: if clientTempId provided, check if already sent in last 60 seconds
    if (data.clientTempId) {
      const existingMsg = await prisma.message.findFirst({
        where: {
          conversationId,
          clientTempId: data.clientTempId,
          senderId: currentUserId,
          createdAt: { gte: new Date(Date.now() - 60000) },
        },
        include: {
          sender: { select: { id: true, fullName: true, role: true } },
        },
      });
      if (existingMsg) {
        return res.json({
          success: true,
          message: 'Message already delivered (deduplicated)',
          data: { message: { ...existingMsg, isMine: true } },
        });
      }
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: currentUserId,
        body: data.body.trim(),
        attachmentUrl: data.attachmentUrl?.trim() || null,
        attachmentType: data.attachmentType || null,
        attachmentName: data.attachmentName?.trim() || null,
        attachmentSize: data.attachmentSize || null,
        clientTempId: data.clientTempId || null,
      },
      include: {
        sender: { select: { id: true, fullName: true, role: true } },
      },
    });

    // Touch conversation updatedAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Notify other members of this conversation
    const senderName = member.conversation.members.find((m) => m.userId === currentUserId)?.user.fullName || 'User';
    const otherMembers = member.conversation.members.filter((m) => m.userId !== currentUserId);

    for (const other of otherMembers) {
      InAppNotificationService.notifyNewChatMessage({
        conversationId,
        messageId: message.id,
        senderId: currentUserId,
        senderName,
        recipientUserId: other.userId,
        recipientRole: other.user.role,
        instituteId,
        studentId: member.conversation.studentId,
        body: message.body,
        attachmentType: message.attachmentType,
      }).catch((err) => console.warn('[Message Notification Dispatch]', err));
    }

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: { message: { ...message, isMine: true } },
    });
  } catch (err: any) {
    console.error('[Send Message Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to send message' });
  }
}

/**
 * Upload chat attachment (Image, Audio Voice Note, PDF Document)
 */
export async function uploadChatAttachment(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id: conversationId } = req.params;
    const currentUserId = req.user!.userId;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No attachment file provided' });
    }

    // Verify membership in conversation
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUserId,
        },
      },
      include: { conversation: true },
    });

    if (!member || member.conversation.instituteId !== instituteId) {
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot upload to this conversation' });
    }

    const file = req.file;
    const relativeKey = getRelativeStorageKey(instituteId, file.filename);

    // Categorize attachment type
    let attachmentType: 'IMAGE' | 'AUDIO' | 'DOCUMENT' = 'DOCUMENT';
    if (file.mimetype.startsWith('image/')) {
      attachmentType = 'IMAGE';
    } else if (file.mimetype.startsWith('audio/') || file.mimetype.includes('audio') || file.mimetype.includes('webm')) {
      attachmentType = 'AUDIO';
    } else if (file.mimetype === 'application/pdf') {
      attachmentType = 'DOCUMENT';
    }

    return res.status(201).json({
      success: true,
      data: {
        fileUrl: `/api/messaging/conversations/${conversationId}/attachments/${file.filename}`,
        storageKey: relativeKey,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        attachmentType,
      },
    });
  } catch (err: any) {
    console.error('[Upload Attachment Error]', err);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    return res.status(500).json({ success: false, error: err.message || 'Failed to upload attachment' });
  }
}

/**
 * Download or stream an attachment securely
 */
export async function getAttachmentFile(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id: conversationId, filename } = req.params;
    const currentUserId = req.user!.userId;

    // Verify membership
    const member = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUserId,
        },
      },
      include: { conversation: true },
    });

    if (!member || member.conversation.instituteId !== instituteId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot view this attachment' });
    }

    const safeKey = `${instituteId}/${filename}`;
    const absPath = resolveAbsolutePath(safeKey);

    if (!absPath || !fs.existsSync(absPath)) {
      return res.status(404).json({ success: false, error: 'Attachment not found on server' });
    }

    const isDownload = req.query.download === 'true';
    if (isDownload) {
      return res.download(absPath, filename);
    }

    return res.sendFile(absPath);
  } catch (err: any) {
    console.error('[Get Attachment Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve attachment' });
  }
}

/**
 * Get eligible contacts directory for initiating new conversations
 */
export async function getEligibleContacts(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const currentUserId = req.user!.userId;
    const userRole = req.user!.role;

    if (userRole === 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    if (userRole === 'STAFF' || userRole === 'ACADEMIC_ADMIN' || userRole === 'SUPER_ADMIN') {
      // Return students in staff's scope with their parents
      let studentWhere: any = { instituteId, status: 'ACTIVE' };
      if (userRole === 'STAFF') {
        const scope = await getAuthorizedStudentScope(req, prisma);
        studentWhere = {
          ...studentWhere,
          ...scope.whereClause,
        };
      }

      const students = await prisma.student.findMany({
        where: studentWhere,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        include: {
          enrollments: {
            where: { isActive: true },
            take: 1,
            select: { batch: { select: { id: true, name: true, code: true } } },
          },
          parentRelations: {
            include: {
              parent: {
                include: {
                  user: { select: { id: true, fullName: true, phone: true, email: true, isActive: true } },
                },
              },
            },
          },
        },
      });

      const contacts = students
        .filter((s) => s.parentRelations.some((pr) => pr.parent?.user?.isActive))
        .map((s) => {
          const primaryRel = s.parentRelations.find((pr) => pr.isPrimaryContact) || s.parentRelations[0];
          const parentUser = primaryRel.parent.user;
          return {
            studentId: s.id,
            studentName: `${s.firstName} ${s.lastName}`.trim(),
            admissionNumber: s.admissionNumber,
            batchName: s.enrollments[0]?.batch?.name || 'Unassigned',
            parentUserId: parentUser.id,
            parentName: parentUser.fullName,
            parentPhone: parentUser.phone,
            parentEmail: parentUser.email,
            relation: primaryRel.relation,
          };
        });

      return res.json({ success: true, data: { contacts } });
    }

    if (userRole === 'PARENT') {
      // Find parent's linked children and the teachers assigned to their batches
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: currentUserId },
        include: {
          studentRelations: {
            include: {
              student: {
                include: {
                  enrollments: {
                    where: { isActive: true },
                    include: {
                      batch: {
                        include: {
                          staffAssignments: {
                            include: {
                              staffProfile: {
                                include: {
                                  user: { select: { id: true, fullName: true, role: true, email: true } },
                                },
                              },
                            },
                          },
                          batchSubjects: {
                            include: {
                              subject: { select: { id: true, name: true } },
                              staffProfile: {
                                include: {
                                  user: { select: { id: true, fullName: true, role: true } },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const childrenContacts: any[] = [];
      const studentRelations = parentProfile?.studentRelations || [];

      for (const rel of studentRelations) {
        const student = rel.student;
        if (student.instituteId !== instituteId) continue;

        const teachersMap = new Map<string, any>();

        for (const enrollment of student.enrollments) {
          const batch = enrollment.batch;
          for (const sa of batch.staffAssignments) {
            const u = sa.staffProfile.user;
            if (!teachersMap.has(u.id)) {
              teachersMap.set(u.id, {
                teacherUserId: u.id,
                teacherName: u.fullName,
                designation: sa.staffProfile.designation || 'Faculty',
                role: u.role,
                batchName: batch.name,
                subjects: [] as string[],
              });
            }
          }

          for (const bs of batch.batchSubjects) {
            if (bs.staffProfile?.user) {
              const u = bs.staffProfile.user;
              if (teachersMap.has(u.id)) {
                const existing = teachersMap.get(u.id);
                if (bs.subject?.name && !existing.subjects.includes(bs.subject.name)) {
                  existing.subjects.push(bs.subject.name);
                }
              } else {
                teachersMap.set(u.id, {
                  teacherUserId: u.id,
                  teacherName: u.fullName,
                  designation: bs.staffProfile.designation || 'Faculty',
                  role: u.role,
                  batchName: batch.name,
                  subjects: bs.subject?.name ? [bs.subject.name] : [],
                });
              }
            }
          }
        }

        childrenContacts.push({
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`.trim(),
          admissionNumber: student.admissionNumber,
          teachers: Array.from(teachersMap.values()),
        });
      }

      return res.json({ success: true, data: { children: childrenContacts } });
    }

    return res.json({ success: true, data: { contacts: [] } });
  } catch (err: any) {
    console.error('[Get Eligible Contacts Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to load eligible contacts' });
  }
}
