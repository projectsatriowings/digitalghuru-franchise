import { Response } from 'express';
import { prisma } from '../../prisma.js';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import {
  isStudentAuthorized,
  isStaffAssignedToBatch,
  isStaffAssignedToBatchSubject,
  getAuthorizedStaffAssignments,
} from '../students/student-authorization.service.js';

export const createBatchSchema = z.object({
  name: z.string().min(2, 'Batch name is required'),
  code: z.string().trim().optional().nullable().or(z.literal('')),
  academicYear: z.string().min(4, 'Academic year is required'), // e.g., "2026-2027"
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
  schedule: z.string().optional(),
  isActive: z.boolean().optional(),
  staffProfileId: z.string().uuid().optional(),
  staffProfileIds: z.array(z.string().uuid()).optional(),
});

export const updateBatchSchema = z.object({
  name: z.string().min(2, 'Batch name is required').optional(),
  code: z.string().trim().optional().nullable().or(z.literal('')),
  academicYear: z.string().min(4, 'Academic year is required').optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  schedule: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createSubjectSchema = z.object({
  name: z.string().min(2, 'Subject name is required'),
  code: z.string().trim().optional().nullable().or(z.literal('')),
  description: z.string().optional(),
});

export const updateSubjectSchema = z.object({
  name: z.string().min(2, 'Subject name is required').optional(),
  code: z.string().trim().optional().nullable().or(z.literal('')),
  description: z.string().optional(),
});

export const assignSubjectsSchema = z.object({
  subjectIds: z.array(z.string().uuid()).optional(),
  subjectId: z.string().uuid().optional(),
  name: z.string().min(2).optional(),
  code: z.string().trim().optional().nullable().or(z.literal('')),
  description: z.string().optional(),
  staffProfileId: z.string().uuid().optional(),
  schedule: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const assignStaffSchema = z.object({
  staffProfileIds: z.array(z.string().uuid()).optional(),
  staffProfileId: z.string().uuid().optional(),
});

export const enrollStudentSchema = z.object({
  studentId: z.string().uuid('Valid student ID required'),
  subjectId: z.string().uuid().optional(),
});

// List Batches
export async function listBatches(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const isStaff = req.user?.role === 'STAFF';
    let batchWhere: any = { instituteId };
    let authorizedSubjectIds: string[] | null = null;
    let staffProfileId: string | null = null;
    let assignments: any = null;

    if (isStaff) {
      assignments = await getAuthorizedStaffAssignments(req, prisma);
      if (assignments.authorizedBatchIds.length === 0) {
        return res.json({ success: true, data: { batches: [] } });
      }
      batchWhere = {
        instituteId,
        id: { in: assignments.authorizedBatchIds },
        isActive: true,
      };
      authorizedSubjectIds = assignments.allAuthorizedSubjectIds;
      staffProfileId = assignments.staffProfileId || null;
    }

    const batches = await prisma.batch.findMany({
      where: batchWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        batchSubjects: {
          select: {
            id: true,
            batchId: true,
            subjectId: true,
            staffProfileId: true,
            subject: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        _count: {
          select: {
            enrollments: true,
            staffAssignments: true,
            batchSubjects: true,
          },
        },
      },
    });

    // If caller is STAFF, filter each batch's batchSubjects to those assigned to this staff member.
    // If staff is assigned to the whole batch with no specific subject restriction, include all subjects in that batch.
    const filteredBatches = isStaff
      ? batches.map((b) => {
          const assignedSubIds = assignments?.subjectIdsByBatch?.[b.id] || [];
          const staffSubjects = assignedSubIds.length === 0
            ? b.batchSubjects
            : b.batchSubjects.filter(
                (bs) =>
                  (staffProfileId && bs.staffProfileId === staffProfileId) ||
                  assignedSubIds.includes(bs.subjectId)
              );
          return {
            ...b,
            batchSubjects: staffSubjects,
          };
        })
      : batches;

    return res.json({ success: true, data: { batches: filteredBatches } });
  } catch (err: any) {
    console.error('[listBatches error]', err);
    return res.status(500).json({ success: false, error: 'Failed to list batches' });
  }
}

// Get Batch Details (Roster, Curriculum, Staff, Allocations)
export async function getBatchDetails(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { id } = req.params;

    // If caller is STAFF, verify staff assignment to this batch
    if (req.user?.role === 'STAFF') {
      const isAssigned = await isStaffAssignedToBatch(req, id, prisma);
      if (!isAssigned) {
        return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
      }
    }

    const batch = await prisma.batch.findFirst({
      where: { id, instituteId },
      include: {
        batchSubjects: {
          include: {
            subject: true,
            staffProfile: {
              include: {
                user: {
                  select: { id: true, fullName: true, email: true, phone: true },
                },
              },
            },
          },
        },
        staffAssignments: {
          include: {
            staffProfile: {
              include: {
                user: {
                  select: { id: true, fullName: true, email: true, phone: true },
                },
              },
            },
          },
        },
        enrollments: {
          where: { isActive: true },
          include: {
            student: {
              select: {
                id: true,
                admissionNumber: true,
                firstName: true,
                lastName: true,
                phone: true,
                status: true,
                photoUrl: true,
              },
            },
            subject: {
              select: { id: true, name: true, code: true },
            },
          },
          orderBy: { enrolledAt: 'desc' },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
    }

    let filteredEnrollments = batch.enrollments;
    let filteredBatchSubjects = batch.batchSubjects;

    if (req.user?.role === 'STAFF') {
      const staffSubjects = await prisma.batchSubject.findMany({
        where: {
          batchId: id,
          staffProfile: { userId: req.user.userId },
        },
        select: { subjectId: true },
      });
      const staffSubjectIds = new Set(staffSubjects.map((s) => s.subjectId));

      if (staffSubjectIds.size > 0) {
        // Staff only sees students enrolled in their assigned subjects
        filteredBatchSubjects = batch.batchSubjects.filter((bs) => staffSubjectIds.has(bs.subjectId));
        const authorizedStudentIds = new Set(
          batch.enrollments
            .filter((e) => e.subjectId && staffSubjectIds.has(e.subjectId))
            .map((e) => e.student.id)
        );
        filteredEnrollments = batch.enrollments.filter((e) => authorizedStudentIds.has(e.student.id));
      }
    }

    // Build consolidated enrolled students map with their allocated subjects
    const enrolledStudentsMap = new Map<string, any>();
    for (const enr of filteredEnrollments) {
      if (!enrolledStudentsMap.has(enr.student.id)) {
        enrolledStudentsMap.set(enr.student.id, {
          ...enr.student,
          photoUrl: (enr.student.photoUrl && !enr.student.photoUrl.startsWith('http') && !enr.student.photoUrl.startsWith('/api')) ? `/api/students/${enr.student.id}/photo` : enr.student.photoUrl,
          enrolledAt: enr.enrolledAt,
          allocatedSubjects: [],
        });
      }
      if (enr.subject) {
        enrolledStudentsMap.get(enr.student.id).allocatedSubjects.push(enr.subject);
      }
    }
    const enrolledStudents = Array.from(enrolledStudentsMap.values());

    return res.json({
      success: true,
      data: {
        batch: {
          ...batch,
          batchSubjects: filteredBatchSubjects,
          enrolledStudents,
          studentAllocations: enrolledStudents,
        },
      },
    });
  } catch (err: any) {
    console.error('[getBatchDetails error]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch batch details' });
  }
}

// Create Batch
export async function createBatch(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const parse = createBatchSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });

    const { name, code, academicYear, startDate, endDate, description, schedule, isActive, staffProfileId, staffProfileIds } = parse.data;

    // Check unique name + academicYear
    const existing = await prisma.batch.findUnique({
      where: {
        instituteId_name_academicYear: {
          instituteId,
          name: name.trim(),
          academicYear: academicYear.trim(),
        },
      },
    });

    if (existing) {
      return res.status(409).json({ success: false, error: `Batch '${name}' (${academicYear}) already exists in this institute` });
    }

    // Check unique code within institute if provided
    if (code && code.trim()) {
      const codeCollision = await prisma.batch.findFirst({
        where: { instituteId, code: code.trim() },
      });
      if (codeCollision) {
        return res.status(409).json({ success: false, error: `Batch code '${code.trim()}' is already in use in this institute` });
      }
    }

    const batch = await prisma.batch.create({
      data: {
        instituteId,
        name: name.trim(),
        code: code?.trim() || null,
        academicYear: academicYear.trim(),
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        description: description?.trim() || null,
        schedule: schedule?.trim() || null,
        isActive: typeof isActive === 'boolean' ? isActive : true,
      },
    });

    // Collect all initial staff profiles to assign to this batch
    const targetStaffIds = new Set<string>();
    if (Array.isArray(staffProfileIds)) {
      staffProfileIds.filter(Boolean).forEach((id: string) => targetStaffIds.add(id));
    }
    if (staffProfileId) {
      targetStaffIds.add(staffProfileId);
    }
    if (targetStaffIds.size === 0 && req.user?.role === 'STAFF') {
      const callerStaff = await prisma.staffProfile.findFirst({
        where: { userId: req.user.userId, instituteId },
      });
      if (callerStaff) {
        targetStaffIds.add(callerStaff.id);
      }
    }

    if (targetStaffIds.size > 0) {
      const validStaff = await prisma.staffProfile.findMany({
        where: {
          id: { in: Array.from(targetStaffIds) },
          instituteId,
        },
        select: { id: true },
      });

      for (const st of validStaff) {
        await prisma.staffBatchAssignment.upsert({
          where: {
            staffProfileId_batchId: {
              staffProfileId: st.id,
              batchId: batch.id,
            },
          },
          create: {
            staffProfileId: st.id,
            batchId: batch.id,
          },
          update: {},
        }).catch((err: any) => console.warn('[createBatch staff assignment warn]', err.message));
      }
    }

    return res.status(201).json({ success: true, message: 'Batch created successfully', data: { batch } });
  } catch (err: any) {
    console.error('[createBatch error]', err);
    return res.status(500).json({ success: false, error: 'Failed to create batch' });
  }
}

// Update Batch
export async function updateBatch(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { id } = req.params;
    const parse = updateBatchSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });

    const existing = await prisma.batch.findFirst({
      where: { id, instituteId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
    }

    const { name, code, academicYear, startDate, endDate, description, schedule, isActive } = parse.data;

    // Check collision if name or academicYear changed
    if ((name && name.trim() !== existing.name) || (academicYear && academicYear.trim() !== existing.academicYear)) {
      const checkName = name ? name.trim() : existing.name;
      const checkYear = academicYear ? academicYear.trim() : existing.academicYear;
      const collision = await prisma.batch.findFirst({
        where: {
          instituteId,
          name: checkName,
          academicYear: checkYear,
          id: { not: id },
        },
      });
      if (collision) {
        return res.status(409).json({ success: false, error: `Batch '${checkName}' (${checkYear}) already exists` });
      }
    }

    // Check code collision
    if (code && code.trim() !== existing.code) {
      const codeCollision = await prisma.batch.findFirst({
        where: {
          instituteId,
          code: code.trim(),
          id: { not: id },
        },
      });
      if (codeCollision) {
        return res.status(409).json({ success: false, error: `Batch code '${code.trim()}' is already in use in this institute` });
      }
    }

    const updated = await prisma.batch.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(code !== undefined ? { code: code ? code.trim() : null } : {}),
        ...(academicYear ? { academicYear: academicYear.trim() } : {}),
        ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
        ...(description !== undefined ? { description: description ? description.trim() : null } : {}),
        ...(schedule !== undefined ? { schedule: schedule ? schedule.trim() : null } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    return res.json({ success: true, message: 'Batch updated successfully', data: { batch: updated } });
  } catch (err: any) {
    console.error('[updateBatch error]', err);
    return res.status(500).json({ success: false, error: 'Failed to update batch' });
  }
}

// Toggle Batch Active Status
export async function toggleBatchStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { id } = req.params;
    const { isActive } = req.body;

    const existing = await prisma.batch.findFirst({
      where: { id, instituteId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
    }

    const nextState = typeof isActive === 'boolean' ? isActive : !existing.isActive;

    const updated = await prisma.batch.update({
      where: { id },
      data: { isActive: nextState },
    });

    return res.json({
      success: true,
      message: `Batch ${nextState ? 'activated' : 'deactivated'} successfully`,
      data: { batch: updated },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to toggle batch status' });
  }
}

// Delete Batch
export async function deleteBatch(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { id } = req.params;

    const existing = await prisma.batch.findFirst({
      where: { id, instituteId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
    }

    // Safely delete associated records and the batch
    await prisma.$transaction([
      prisma.batchSubject.deleteMany({ where: { batchId: id } }),
      prisma.staffBatchAssignment.deleteMany({ where: { batchId: id } }),
      prisma.studentEnrollment.deleteMany({ where: { batchId: id } }),
      prisma.attendanceEvent.deleteMany({ where: { batchId: id } }),
      prisma.batch.delete({ where: { id } }),
    ]);

    return res.json({
      success: true,
      message: `Batch '${existing.name}' deleted successfully`,
    });
  } catch (err: any) {
    console.error('[deleteBatch error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to delete batch' });
  }
}

// Assign or Create Subjects inside Batch
export async function assignSubjectsToBatch(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { id: batchId } = req.params;
    const parse = assignSubjectsSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });

    const batch = await prisma.batch.findFirst({
      where: { id: batchId, instituteId },
    });
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
    }

    // Direct Subject Creation / Addition inside Batch
    if (parse.data.name && parse.data.name.trim()) {
      const subjectName = parse.data.name.trim();
      const subjectCode = parse.data.code && parse.data.code.trim() ? parse.data.code.trim().toUpperCase() : null;

      // Validate subject code uniqueness within the institute if code is supplied
      if (subjectCode) {
        const codeCollision = await prisma.subject.findFirst({
          where: {
            instituteId,
            code: subjectCode,
            NOT: { name: { equals: subjectName, mode: 'insensitive' } },
          },
        });
        if (codeCollision) {
          return res.status(409).json({
            success: false,
            error: `Subject code '${subjectCode}' is already in use by '${codeCollision.name}' in this institute`,
          });
        }
      }

      // Find or create reusable subject in this institute
      let subject = await prisma.subject.findFirst({
        where: {
          instituteId,
          name: { equals: subjectName, mode: 'insensitive' },
        },
      });

      if (!subject && subjectCode) {
        subject = await prisma.subject.findFirst({
          where: { instituteId, code: subjectCode },
        });
      }

      if (!subject) {
        subject = await prisma.subject.create({
          data: {
            instituteId,
            name: subjectName,
            code: subjectCode,
            description: parse.data.description ? parse.data.description.trim() : null,
          },
        });
      }

      // Check if already assigned to this batch
      const existingAssignment = await prisma.batchSubject.findUnique({
        where: {
          batchId_subjectId: {
            batchId,
            subjectId: subject.id,
          },
        },
      });

      if (existingAssignment) {
        return res.status(409).json({
          success: false,
          error: `Subject '${subject.name}' is already assigned to this batch`,
        });
      }

      const batchSubject = await prisma.batchSubject.create({
        data: {
          batchId,
          subjectId: subject.id,
          staffProfileId: parse.data.staffProfileId || null,
          description: parse.data.description ? parse.data.description.trim() : null,
          schedule: parse.data.schedule ? parse.data.schedule.trim() : null,
          isActive: parse.data.isActive !== false,
        },
        include: {
          subject: true,
          staffProfile: {
            include: {
              user: { select: { id: true, fullName: true, email: true, phone: true } },
            },
          },
        },
      });

      // Ensure staff is also assigned to batch if specified
      if (parse.data.staffProfileId) {
        await prisma.staffBatchAssignment.upsert({
          where: {
            staffProfileId_batchId: {
              staffProfileId: parse.data.staffProfileId,
              batchId,
            },
          },
          create: {
            staffProfileId: parse.data.staffProfileId,
            batchId,
          },
          update: {},
        });
      }

      return res.status(201).json({
        success: true,
        message: `Subject '${subject.name}' added to batch successfully`,
        data: { batchSubject },
      });
    }

    const subjectIds = parse.data.subjectIds || (parse.data.subjectId ? [parse.data.subjectId] : []);
    if (subjectIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Subject name or subjectId must be provided' });
    }

    // Check for duplicate assignments
    const existingLinks = await prisma.batchSubject.findMany({
      where: {
        batchId,
        subjectId: { in: subjectIds },
      },
      include: { subject: true },
    });

    if (existingLinks.length > 0) {
      const names = existingLinks.map((l) => l.subject.name).join(', ');
      return res.status(409).json({
        success: false,
        error: `Subject(s) ${names} already assigned to this batch`,
      });
    }

    // Verify all subjects belong to this institute
    const subjects = await prisma.subject.findMany({
      where: {
        id: { in: subjectIds },
        instituteId,
      },
    });

    if (subjects.length !== subjectIds.length) {
      return res.status(400).json({ success: false, error: 'One or more subjects do not exist in this institute' });
    }

    for (const sid of subjectIds) {
      await prisma.batchSubject.create({
        data: {
          batchId,
          subjectId: sid,
          staffProfileId: parse.data.staffProfileId || null,
          description: parse.data.description ? parse.data.description.trim() : null,
          schedule: parse.data.schedule ? parse.data.schedule.trim() : null,
          isActive: parse.data.isActive !== false,
        },
      });
    }

    if (parse.data.staffProfileId) {
      await prisma.staffBatchAssignment.upsert({
        where: {
          staffProfileId_batchId: {
            staffProfileId: parse.data.staffProfileId,
            batchId,
          },
        },
        create: {
          staffProfileId: parse.data.staffProfileId,
          batchId,
        },
        update: {},
      });
    }

    const updatedBatch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        batchSubjects: {
          include: {
            subject: true,
            staffProfile: {
              include: { user: { select: { id: true, fullName: true, email: true } } },
            },
          },
        },
      },
    });

    return res.json({
      success: true,
      message: `${subjectIds.length} subject(s) assigned to batch successfully`,
      data: { batch: updatedBatch },
    });
  } catch (err: any) {
    console.error('[assignSubjectsToBatch error]', err);
    return res.status(500).json({ success: false, error: 'Failed to assign subjects to batch' });
  }
}

// Update Subject Inside Batch
export async function updateBatchSubject(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { id: batchId, subjectId } = req.params;
    const { name, code, description, staffProfileId, schedule, isActive } = req.body;

    const batch = await prisma.batch.findFirst({
      where: { id: batchId, instituteId },
    });
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
    }

    const existing = await prisma.batchSubject.findUnique({
      where: {
        batchId_subjectId: {
          batchId,
          subjectId,
        },
      },
      include: { subject: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Subject is not assigned to this batch' });
    }

    // Optionally update Subject title/code if provided
    if (name || code !== undefined) {
      if (code && code.trim()) {
        const cleanCode = code.trim().toUpperCase();
        const codeCollision = await prisma.subject.findFirst({
          where: { instituteId, code: cleanCode, id: { not: subjectId } },
        });
        if (codeCollision) {
          return res.status(409).json({ success: false, error: `Subject code '${cleanCode}' is already in use in this institute` });
        }
      }
      await prisma.subject.update({
        where: { id: subjectId },
        data: {
          ...(name ? { name: name.trim() } : {}),
          ...(code !== undefined ? { code: (code && code.trim()) ? code.trim().toUpperCase() : null } : {}),
        },
      });
    }

    const updated = await prisma.batchSubject.update({
      where: {
        batchId_subjectId: {
          batchId,
          subjectId,
        },
      },
      data: {
        ...(description !== undefined ? { description: description ? description.trim() : null } : {}),
        ...(schedule !== undefined ? { schedule: schedule ? schedule.trim() : null } : {}),
        ...(staffProfileId !== undefined ? { staffProfileId: staffProfileId || null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
      include: {
        subject: true,
        staffProfile: {
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true } },
          },
        },
      },
    });

    if (staffProfileId) {
      await prisma.staffBatchAssignment.upsert({
        where: {
          staffProfileId_batchId: {
            staffProfileId,
            batchId,
          },
        },
        create: {
          staffProfileId,
          batchId,
        },
        update: {},
      });
    }

    return res.json({
      success: true,
      message: 'Batch subject updated successfully',
      data: { batchSubject: updated },
    });
  } catch (err: any) {
    console.error('[updateBatchSubject error]', err);
    return res.status(500).json({ success: false, error: 'Failed to update batch subject' });
  }
}

// Allocate Student Subjects within Batch
export async function allocateStudentSubjects(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const batchId = req.params.id || req.body.batchId;
    const studentId = req.params.studentId || req.body.studentId;
    const { subjectIds } = req.body;

    if (!batchId) return res.status(400).json({ success: false, error: 'Batch ID is required' });
    if (!studentId) return res.status(400).json({ success: false, error: 'Student ID is required' });
    if (!Array.isArray(subjectIds)) {
      return res.status(400).json({ success: false, error: 'subjectIds array is required' });
    }

    // 1. Verify batch in institute
    const batch = await prisma.batch.findFirst({
      where: { id: batchId, instituteId },
    });
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
    }

    // 2. Verify student in institute
    const student = await prisma.student.findFirst({
      where: { id: studentId, instituteId },
    });
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found in this institute' });
    }

    // 3. Staff authorization check: Staff cannot allocate subjects for unauthorized students
    const isAuth = await isStudentAuthorized(req, studentId, prisma);
    if (!isAuth) {
      return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to allocate subjects for this student' });
    }

    // 4. Verify ALL subjectIds are assigned to THIS batch
    if (subjectIds.length > 0) {
      const batchSubjects = await prisma.batchSubject.findMany({
        where: {
          batchId,
          subjectId: { in: subjectIds },
        },
      });

      if (batchSubjects.length !== subjectIds.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more subjects are not assigned to this batch. Students can only be allocated to subjects assigned to their batch.',
        });
      }

      // If caller is STAFF, verify staff is assigned to teach ALL requested subjects in this batch
      if (req.user?.role === 'STAFF') {
        for (const sid of subjectIds) {
          const isAssigned = await isStaffAssignedToBatchSubject(req, batchId, sid, prisma);
          if (!isAssigned) {
            return res.status(403).json({
              success: false,
              error: `Forbidden: You are not authorized to allocate subject '${sid}' in this batch.`,
            });
          }
        }
      }
    }

    // 5. Transactionally update student subject allocations
    await prisma.$transaction(async (tx) => {
      // Ensure primary batch enrollment exists
      const existingPrimary = await tx.studentEnrollment.findFirst({
        where: { studentId, batchId, subjectId: null },
      });
      if (!existingPrimary) {
        await tx.studentEnrollment.create({
          data: { studentId, batchId, subjectId: null, isActive: true },
        });
      } else if (!existingPrimary.isActive) {
        await tx.studentEnrollment.update({
          where: { id: existingPrimary.id },
          data: { isActive: true },
        });
      }

      // Remove subject enrollments for this batch that are not in subjectIds
      // If caller is STAFF, only remove subjects that this staff member is assigned to teach!
      if (req.user?.role === 'STAFF') {
        const staffSubjects = await tx.batchSubject.findMany({
          where: {
            batchId,
            staffProfile: { userId: req.user.userId },
          },
          select: { subjectId: true },
        });
        const staffSubjectIds = staffSubjects.map((s) => s.subjectId);
        if (staffSubjectIds.length > 0) {
          await tx.studentEnrollment.deleteMany({
            where: {
              studentId,
              batchId,
              subjectId: { in: staffSubjectIds, notIn: subjectIds },
            },
          });
        }
      } else {
        await tx.studentEnrollment.deleteMany({
          where: {
            studentId,
            batchId,
            subjectId: { not: null, notIn: subjectIds },
          },
        });
      }

      // Upsert/create each allocated subject enrollment
      for (const sid of subjectIds) {
        const existingSubEnrollment = await tx.studentEnrollment.findFirst({
          where: { studentId, batchId, subjectId: sid },
        });
        if (!existingSubEnrollment) {
          await tx.studentEnrollment.create({
            data: { studentId, batchId, subjectId: sid, isActive: true },
          });
        } else if (!existingSubEnrollment.isActive) {
          await tx.studentEnrollment.update({
            where: { id: existingSubEnrollment.id },
            data: { isActive: true },
          });
        }
      }
    });

    // Fetch updated allocations
    const currentAllocations = await prisma.studentEnrollment.findMany({
      where: {
        studentId,
        batchId,
        subjectId: { not: null },
        isActive: true,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    return res.json({
      success: true,
      message: 'Student subject allocations updated successfully',
      data: {
        studentId,
        batchId,
        allocatedSubjects: currentAllocations.map((a) => a.subject),
      },
    });
  } catch (err: any) {
    console.error('[allocateStudentSubjects error]', err);
    return res.status(500).json({ success: false, error: 'Failed to allocate student subjects' });
  }
}

// Get Student Subject Allocations within Batch
export async function getStudentSubjectAllocations(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const batchId = req.params.id || (req.query.batchId as string);
    const studentId = req.params.studentId || (req.query.studentId as string);

    if (!studentId) return res.status(400).json({ success: false, error: 'Student ID is required' });

    const isAuth = await isStudentAuthorized(req, studentId, prisma);
    if (!isAuth) {
      return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to access this student' });
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, instituteId },
      select: {
        id: true,
        admissionNumber: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
      },
    });
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found in this institute' });
    }

    // Determine target batch
    let targetBatchId: string | undefined = batchId;
    if (!targetBatchId) {
      const primaryEnrollment = await prisma.studentEnrollment.findFirst({
        where: { studentId, isActive: true },
        orderBy: { enrolledAt: 'desc' },
      });
      if (primaryEnrollment) {
        targetBatchId = primaryEnrollment.batchId;
      }
    }

    if (!targetBatchId) {
      return res.json({
        success: true,
        data: {
          student,
          batch: null,
          batchSubjects: [],
          allocatedSubjectIds: [],
        },
      });
    }

    const batch = await prisma.batch.findFirst({
      where: { id: targetBatchId, instituteId },
      include: {
        batchSubjects: {
          include: {
            subject: true,
            staffProfile: {
              include: {
                user: { select: { fullName: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
    }

    const activeAllocations = await prisma.studentEnrollment.findMany({
      where: {
        studentId,
        batchId: targetBatchId,
        subjectId: { not: null },
        isActive: true,
      },
    });

    const allocatedSubjectIds = activeAllocations.map((a) => a.subjectId as string);

    return res.json({
      success: true,
      data: {
        student,
        batch: {
          id: batch.id,
          name: batch.name,
          code: batch.code,
          academicYear: batch.academicYear,
        },
        batchSubjects: batch.batchSubjects.map((bs) => ({
          id: bs.subjectId,
          name: bs.subject.name,
          code: bs.subject.code,
          description: bs.description || bs.subject.description,
          schedule: bs.schedule,
          teacherName: bs.staffProfile?.user?.fullName || null,
          isActive: bs.isActive,
        })),
        allocatedSubjectIds,
      },
    });
  } catch (err: any) {
    console.error('[getStudentSubjectAllocations error]', err);
    return res.status(500).json({ success: false, error: 'Failed to get student subject allocations' });
  }
}

// Remove Subject from Batch
export async function removeSubjectFromBatch(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { id: batchId, subjectId } = req.params;

    const batch = await prisma.batch.findFirst({
      where: { id: batchId, instituteId },
    });
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
    }

    await prisma.batchSubject.deleteMany({
      where: {
        batchId,
        subjectId,
      },
    });

    return res.json({ success: true, message: 'Subject removed from batch successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to remove subject from batch' });
  }
}

// Assign Staff to Batch
export async function assignStaffToBatch(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { id: batchId } = req.params;
    const parse = assignStaffSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });

    const batch = await prisma.batch.findFirst({
      where: { id: batchId, instituteId },
    });
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
    }

    const staffProfileIds = parse.data.staffProfileIds || (parse.data.staffProfileId ? [parse.data.staffProfileId] : []);
    if (staffProfileIds.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one staffProfileId must be provided' });
    }

    // Verify all staff belong to this institute
    const staffList = await prisma.staffProfile.findMany({
      where: {
        id: { in: staffProfileIds },
        instituteId,
      },
    });

    if (staffList.length !== staffProfileIds.length) {
      return res.status(400).json({ success: false, error: 'One or more staff members do not belong to this institute' });
    }

    for (const spId of staffProfileIds) {
      await prisma.staffBatchAssignment.upsert({
        where: {
          staffProfileId_batchId: {
            staffProfileId: spId,
            batchId,
          },
        },
        create: {
          staffProfileId: spId,
          batchId,
        },
        update: {},
      });
    }

    const updatedBatch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        staffAssignments: {
          include: {
            staffProfile: {
              include: {
                user: { select: { fullName: true, email: true } },
              },
            },
          },
        },
      },
    });

    return res.json({
      success: true,
      message: 'Staff assigned to batch successfully',
      data: { batch: updatedBatch },
    });
  } catch (err: any) {
    console.error('[assignStaffToBatch error]', err);
    return res.status(500).json({ success: false, error: 'Failed to assign staff to batch' });
  }
}

// Remove Staff from Batch
export async function removeStaffFromBatch(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { id: batchId, staffProfileId } = req.params;

    const batch = await prisma.batch.findFirst({
      where: { id: batchId, instituteId },
    });
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
    }

    await prisma.staffBatchAssignment.deleteMany({
      where: {
        batchId,
        staffProfileId,
      },
    });

    return res.json({ success: true, message: 'Staff removed from batch successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to remove staff from batch' });
  }
}

// Enroll Student in Batch
export async function enrollStudentInBatch(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { id: batchId } = req.params;
    const parse = enrollStudentSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });

    const { studentId, subjectId } = parse.data;

    // Verify batch
    const batch = await prisma.batch.findFirst({
      where: { id: batchId, instituteId },
    });
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
    }

    // Verify student belongs to this institute and is authorized for caller
    const isAuth = await isStudentAuthorized(req, studentId, prisma);
    if (!isAuth) {
      return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to enroll this student' });
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, instituteId },
    });
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found in this institute' });
    }
    if (student.status !== 'ACTIVE') {
      return res.status(400).json({ success: false, error: `Cannot enroll student in ${student.status} status` });
    }

    // If subjectId is given, verify it belongs to this institute
    if (subjectId) {
      const subject = await prisma.subject.findFirst({
        where: { id: subjectId, instituteId },
      });
      if (!subject) {
        return res.status(404).json({ success: false, error: 'Subject not found in this institute' });
      }
    }

    // Upsert enrollment
    const existing = await prisma.studentEnrollment.findFirst({
      where: {
        studentId,
        batchId,
        subjectId: subjectId || null,
      },
    });

    let enrollment;
    if (existing) {
      enrollment = await prisma.studentEnrollment.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    } else {
      enrollment = await prisma.studentEnrollment.create({
        data: {
          studentId,
          batchId,
          subjectId: subjectId || null,
          isActive: true,
        },
      });
    }

    return res.status(201).json({
      success: true,
      message: `${student.firstName} ${student.lastName} enrolled in batch successfully`,
      data: { enrollment },
    });
  } catch (err: any) {
    console.error('[enrollStudentInBatch error]', err);
    return res.status(500).json({ success: false, error: 'Failed to enroll student in batch' });
  }
}

// Unenroll Student from Batch
export async function unenrollStudentFromBatch(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { id: batchId, studentId } = req.params;

    const batch = await prisma.batch.findFirst({
      where: { id: batchId, instituteId },
    });
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
    }

    const isAuth = await isStudentAuthorized(req, studentId, prisma);
    if (!isAuth) {
      return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to unenroll this student' });
    }

    await prisma.studentEnrollment.updateMany({
      where: {
        batchId,
        studentId,
      },
      data: { isActive: false },
    });

    return res.json({ success: true, message: 'Student unenrolled from batch successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to unenroll student from batch' });
  }
}

// List Institute Staff (for dropdown assignment)
export async function listInstituteStaff(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const staffMembers = await prisma.staffProfile.findMany({
      where: { instituteId },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = staffMembers
      .filter((s) => s.user.isActive)
      .map((s) => ({
        staffProfileId: s.id,
        userId: s.user.id,
        fullName: s.user.fullName,
        email: s.user.email,
        phone: s.user.phone,
        employeeCode: s.employeeCode,
        designation: s.designation,
      }));

    return res.json({ success: true, data: { staff: formatted } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to list institute staff' });
  }
}

// List Subjects
export async function listSubjects(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const subjects = await prisma.subject.findMany({
      where: { instituteId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            batchSubjects: true,
            enrollments: true,
          },
        },
      },
    });

    return res.json({ success: true, data: { subjects } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to list subjects' });
  }
}

// Create Subject
export async function createSubject(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const parse = createSubjectSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });

    const { name, code, description } = parse.data;

    const existing = await prisma.subject.findUnique({
      where: {
        instituteId_name: {
          instituteId,
          name: name.trim(),
        },
      },
    });

    if (existing) {
      return res.status(409).json({ success: false, error: `Subject '${name}' already exists in this institute` });
    }

    if (code && code.trim()) {
      const codeCollision = await prisma.subject.findFirst({
        where: { instituteId, code: code.trim().toUpperCase() },
      });
      if (codeCollision) {
        return res.status(409).json({ success: false, error: `Subject code '${code.trim().toUpperCase()}' is already in use in this institute` });
      }
    }

    const subject = await prisma.subject.create({
      data: {
        instituteId,
        name: name.trim(),
        code: (code && code.trim()) ? code.trim().toUpperCase() : null,
        description: description?.trim() || null,
      },
    });

    return res.status(201).json({ success: true, message: 'Subject created successfully', data: { subject } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to create subject' });
  }
}

// Update Subject
export async function updateSubject(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { id } = req.params;
    const parse = updateSubjectSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });

    const existing = await prisma.subject.findFirst({
      where: { id, instituteId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Subject not found in this institute' });
    }

    const { name, code, description } = parse.data;

    if (name && name.trim() !== existing.name) {
      const collision = await prisma.subject.findFirst({
        where: {
          instituteId,
          name: name.trim(),
          id: { not: id },
        },
      });
      if (collision) {
        return res.status(409).json({ success: false, error: `Subject '${name.trim()}' already exists in this institute` });
      }
    }

    const cleanCode = code !== undefined ? ((code && code.trim()) ? code.trim().toUpperCase() : null) : undefined;
    if (cleanCode) {
      const codeCollision = await prisma.subject.findFirst({
        where: {
          instituteId,
          code: cleanCode,
          id: { not: id },
        },
      });
      if (codeCollision) {
        return res.status(409).json({ success: false, error: `Subject code '${cleanCode}' is already in use in this institute` });
      }
    }

    const updated = await prisma.subject.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(code !== undefined ? { code: cleanCode } : {}),
        ...(description !== undefined ? { description: description ? description.trim() : null } : {}),
      },
    });

    return res.json({ success: true, message: 'Subject updated successfully', data: { subject: updated } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to update subject' });
  }
}

// Delete Subject
export async function deleteSubject(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { id } = req.params;

    const existing = await prisma.subject.findFirst({
      where: { id, instituteId },
      include: {
        _count: {
          select: { batchSubjects: true, enrollments: true },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Subject not found in this institute' });
    }

    if (existing._count.batchSubjects > 0 || existing._count.enrollments > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete subject '${existing.name}' because it is linked to active batches or student enrollments. Remove it from batches first.`,
      });
    }

    await prisma.subject.delete({ where: { id } });

    return res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to delete subject' });
  }
}
