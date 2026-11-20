"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMessageSchema = exports.startConversationSchema = void 0;
exports.listUserConversations = listUserConversations;
exports.getOrCreateConversation = getOrCreateConversation;
exports.getConversationMessages = getConversationMessages;
exports.sendMessage = sendMessage;
exports.uploadChatAttachment = uploadChatAttachment;
exports.getAttachmentFile = getAttachmentFile;
exports.getEligibleContacts = getEligibleContacts;
const fs_1 = __importDefault(require("fs"));
const prisma_js_1 = require("../../prisma.js");
const zod_1 = require("zod");
const student_authorization_service_js_1 = require("../students/student-authorization.service.js");
const inapp_notification_service_js_1 = require("../notifications/inapp-notification.service.js");
const storage_js_1 = require("../../utils/storage.js");
exports.startConversationSchema = zod_1.z.object({
    recipientUserId: zod_1.z.string().uuid('Valid recipient user ID required'),
    studentId: zod_1.z.string().uuid('Valid student ID required').optional().nullable(),
    title: zod_1.z.string().max(100).optional().nullable(),
});
exports.sendMessageSchema = zod_1.z.object({
    body: zod_1.z.string().max(3000).default(''),
    attachmentUrl: zod_1.z.string().optional().nullable(),
    attachmentType: zod_1.z.enum(['IMAGE', 'AUDIO', 'DOCUMENT']).optional().nullable(),
    attachmentName: zod_1.z.string().max(255).optional().nullable(),
    attachmentSize: zod_1.z.number().int().nonnegative().optional().nullable(),
    clientTempId: zod_1.z.string().max(100).optional().nullable(),
}).refine((data) => data.body.trim().length > 0 || !!data.attachmentUrl, {
    message: 'Message must include either text body or attachment',
});
/**
 * List conversations for the logged in user with full student, parent, batch and unread status
 */
async function listUserConversations(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const currentUserId = req.user.userId;
        const userRole = req.user.role;
        // Students are not permitted to access staff-parent private communication
        if (userRole === 'STUDENT') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Students are not authorized to view parent-teacher communications.',
            });
        }
        const search = (req.query.search || '').trim();
        const filter = (req.query.filter || 'ALL').toUpperCase(); // ALL, UNREAD, READ
        // Base query: conversations where the current user is a member
        let whereClause = {
            instituteId,
            members: { some: { userId: currentUserId } },
        };
        // Role-specific scoping:
        if (userRole === 'STAFF') {
            const scope = await (0, student_authorization_service_js_1.getAuthorizedStudentScope)(req, prisma_js_1.prisma);
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
        }
        else if (userRole === 'PARENT') {
            // Find children linked to this parent
            const parentProfile = await prisma_js_1.prisma.parentProfile.findUnique({
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
        const conversations = await prisma_js_1.prisma.conversation.findMany({
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
        const formatted = await Promise.all(conversations.map(async (conv) => {
            const otherMembers = conv.members.filter((m) => m.userId !== currentUserId);
            const myMembership = conv.members.find((m) => m.userId === currentUserId);
            const lastMessage = conv.messages[0] || null;
            // Count unread messages for this user in this conversation
            let unreadCount = 0;
            if (myMembership?.lastReadAt) {
                unreadCount = await prisma_js_1.prisma.message.count({
                    where: {
                        conversationId: conv.id,
                        senderId: { not: currentUserId },
                        createdAt: { gt: myMembership.lastReadAt },
                    },
                });
            }
            else {
                unreadCount = await prisma_js_1.prisma.message.count({
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
        }));
        // Apply search and read/unread filters
        let results = formatted;
        if (search) {
            const q = search.toLowerCase();
            results = results.filter((c) => c.student?.fullName?.toLowerCase().includes(q) ||
                c.student?.admissionNumber?.toLowerCase().includes(q) ||
                c.parent?.fullName?.toLowerCase().includes(q) ||
                c.otherUser?.fullName?.toLowerCase().includes(q) ||
                c.title?.toLowerCase().includes(q) ||
                c.lastMessage?.body?.toLowerCase().includes(q));
        }
        if (filter === 'UNREAD') {
            results = results.filter((c) => c.isUnread);
        }
        else if (filter === 'READ') {
            results = results.filter((c) => !c.isUnread);
        }
        return res.json({ success: true, data: { conversations: results } });
    }
    catch (err) {
        console.error('[List Conversations Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to list conversations' });
    }
}
/**
 * Start or retrieve existing 1-on-1 conversation associated with student
 */
async function getOrCreateConversation(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const currentUserId = req.user.userId;
        const userRole = req.user.role;
        if (userRole === 'STUDENT') {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: Students cannot create parent-staff conversations.',
            });
        }
        const parse = exports.startConversationSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const { recipientUserId, studentId, title } = parse.data;
        if (recipientUserId === currentUserId) {
            return res.status(400).json({ success: false, error: 'Cannot start conversation with yourself' });
        }
        // Verify recipient user
        const recipientUser = await prisma_js_1.prisma.user.findFirst({
            where: { id: recipientUserId, isActive: true },
            select: { id: true, fullName: true, role: true },
        });
        if (!recipientUser) {
            return res.status(404).json({ success: false, error: 'Recipient user not found or inactive' });
        }
        // Authorization checks based on roles and student
        let verifiedStudentId = null;
        if (studentId) {
            const student = await prisma_js_1.prisma.student.findFirst({
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
            }
            else if (userRole === 'STAFF') {
                // Staff must have assignment to student's batch or subject
                const studentBatchIds = student.enrollments.map((e) => e.batchId);
                const hasAssignment = await prisma_js_1.prisma.staffBatchAssignment.findFirst({
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
        const existing = await prisma_js_1.prisma.conversation.findFirst({
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
        const conversation = await prisma_js_1.prisma.conversation.create({
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
    }
    catch (err) {
        console.error('[Start Conversation Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to initiate conversation' });
    }
}
/**
 * Get messages in a conversation with pagination
 */
async function getConversationMessages(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id: conversationId } = req.params;
        const currentUserId = req.user.userId;
        const userRole = req.user.role;
        if (userRole === 'STUDENT') {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        // Verify user is a member of this conversation in this institute
        const member = await prisma_js_1.prisma.conversationMember.findUnique({
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
            const scope = await (0, student_authorization_service_js_1.getAuthorizedStudentScope)(req, prisma_js_1.prisma);
            const isAuthorized = await prisma_js_1.prisma.student.findFirst({
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
        await prisma_js_1.prisma.conversationMember.update({
            where: { id: member.id },
            data: { lastReadAt: new Date() },
        });
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
        const skip = (page - 1) * limit;
        const [total, rawMessages] = await Promise.all([
            prisma_js_1.prisma.message.count({ where: { conversationId } }),
            prisma_js_1.prisma.message.findMany({
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
    }
    catch (err) {
        console.error('[Get Messages Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch messages' });
    }
}
/**
 * Send a message in a conversation (text and/or attachment)
 */
async function sendMessage(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id: conversationId } = req.params;
        const currentUserId = req.user.userId;
        const userRole = req.user.role;
        if (userRole === 'STUDENT') {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        const parse = exports.sendMessageSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message || 'Validation failed' });
        }
        // Verify membership
        const member = await prisma_js_1.prisma.conversationMember.findUnique({
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
            const existingMsg = await prisma_js_1.prisma.message.findFirst({
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
        const message = await prisma_js_1.prisma.message.create({
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
        await prisma_js_1.prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
        });
        // Notify other members of this conversation
        const senderName = member.conversation.members.find((m) => m.userId === currentUserId)?.user.fullName || 'User';
        const otherMembers = member.conversation.members.filter((m) => m.userId !== currentUserId);
        for (const other of otherMembers) {
            inapp_notification_service_js_1.InAppNotificationService.notifyNewChatMessage({
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
    }
    catch (err) {
        console.error('[Send Message Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to send message' });
    }
}
/**
 * Upload chat attachment (Image, Audio Voice Note, PDF Document)
 */
async function uploadChatAttachment(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id: conversationId } = req.params;
        const currentUserId = req.user.userId;
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No attachment file provided' });
        }
        // Verify membership in conversation
        const member = await prisma_js_1.prisma.conversationMember.findUnique({
            where: {
                conversationId_userId: {
                    conversationId,
                    userId: currentUserId,
                },
            },
            include: { conversation: true },
        });
        if (!member || member.conversation.instituteId !== instituteId) {
            if (req.file.path && fs_1.default.existsSync(req.file.path)) {
                fs_1.default.unlinkSync(req.file.path);
            }
            return res.status(403).json({ success: false, error: 'Forbidden: You cannot upload to this conversation' });
        }
        const file = req.file;
        const relativeKey = (0, storage_js_1.getRelativeStorageKey)(instituteId, file.filename);
        // Categorize attachment type
        let attachmentType = 'DOCUMENT';
        if (file.mimetype.startsWith('image/')) {
            attachmentType = 'IMAGE';
        }
        else if (file.mimetype.startsWith('audio/') || file.mimetype.includes('audio') || file.mimetype.includes('webm')) {
            attachmentType = 'AUDIO';
        }
        else if (file.mimetype === 'application/pdf') {
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
    }
    catch (err) {
        console.error('[Upload Attachment Error]', err);
        if (req.file?.path && fs_1.default.existsSync(req.file.path)) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch { }
        }
        return res.status(500).json({ success: false, error: err.message || 'Failed to upload attachment' });
    }
}
/**
 * Download or stream an attachment securely
 */
async function getAttachmentFile(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id: conversationId, filename } = req.params;
        const currentUserId = req.user.userId;
        // Verify membership
        const member = await prisma_js_1.prisma.conversationMember.findUnique({
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
        const absPath = (0, storage_js_1.resolveAbsolutePath)(safeKey);
        if (!absPath || !fs_1.default.existsSync(absPath)) {
            return res.status(404).json({ success: false, error: 'Attachment not found on server' });
        }
        const isDownload = req.query.download === 'true';
        if (isDownload) {
            return res.download(absPath, filename);
        }
        return res.sendFile(absPath);
    }
    catch (err) {
        console.error('[Get Attachment Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve attachment' });
    }
}
/**
 * Get eligible contacts directory for initiating new conversations
 */
async function getEligibleContacts(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const currentUserId = req.user.userId;
        const userRole = req.user.role;
        if (userRole === 'STUDENT') {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        if (userRole === 'STAFF' || userRole === 'ACADEMIC_ADMIN' || userRole === 'SUPER_ADMIN') {
            // Return students in staff's scope with their parents
            let studentWhere = { instituteId, status: 'ACTIVE' };
            if (userRole === 'STAFF') {
                const scope = await (0, student_authorization_service_js_1.getAuthorizedStudentScope)(req, prisma_js_1.prisma);
                studentWhere = {
                    ...studentWhere,
                    ...scope.whereClause,
                };
            }
            const students = await prisma_js_1.prisma.student.findMany({
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
            const parentProfile = await prisma_js_1.prisma.parentProfile.findUnique({
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
            const childrenContacts = [];
            const studentRelations = parentProfile?.studentRelations || [];
            for (const rel of studentRelations) {
                const student = rel.student;
                if (student.instituteId !== instituteId)
                    continue;
                const teachersMap = new Map();
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
                                subjects: [],
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
                            }
                            else {
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
    }
    catch (err) {
        console.error('[Get Eligible Contacts Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to load eligible contacts' });
    }
}
