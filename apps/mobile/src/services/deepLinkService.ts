import { navigate } from '../navigation/navigationRef';
import { useAuthStore } from '../store/authStore';
import { useParentStore } from '../store/parentStore';
import { useTeacherStore } from '../store/teacherStore';

export interface NotificationPayload {
  notificationId?: string;
  role?: string;
  entityType?: string;
  entityId?: string;
  studentId?: string;
  batchId?: string;
  homeworkId?: string;
  link?: string;
  [key: string]: any;
}

/**
 * Validates and routes user to the destination screen based on their role and permissions.
 */
export function handleNotificationDeepLink(payload: NotificationPayload) {
  if (!payload) return;

  const { isAuthenticated, activeRole } = useAuthStore.getState();
  if (!isAuthenticated || !activeRole) {
    console.log('[DeepLink] User not authenticated; postponing deep link');
    return;
  }

  const entityType = String(payload.entityType || '').toUpperCase();
  const entityId = payload.entityId || payload.homeworkId;
  const studentId = payload.studentId;
  const batchId = payload.batchId;

  console.log(`[DeepLink] Routing for role=${activeRole}, entityType=${entityType}, entityId=${entityId}`);

  switch (activeRole) {
    case 'STUDENT': {
      switch (entityType) {
        case 'HOMEWORK':
          navigate('StudentHomework', { homeworkId: entityId });
          break;
        case 'EXAM':
          navigate('StudentAcademics', { examId: entityId });
          break;
        case 'MATERIAL':
          navigate('StudentMaterials', { materialId: entityId });
          break;
        case 'ATTENDANCE':
          navigate('StudentAttendance');
          break;
        case 'QUIZ':
          navigate('StudentAcademics');
          break;
        default:
          navigate('StudentNotifications');
          break;
      }
      break;
    }

    case 'PARENT': {
      // If studentId is present, validate and select child context
      if (studentId) {
        const { children, setSelectedChild } = useParentStore.getState();
        const matchedChild = children.find((c) => c.id === studentId);
        if (matchedChild) {
          setSelectedChild(matchedChild);
        }
      }

      switch (entityType) {
        case 'ATTENDANCE':
          navigate('ParentAttendance', { childId: studentId });
          break;
        case 'HOMEWORK':
          navigate('ParentHomework', { childId: studentId, homeworkId: entityId });
          break;
        case 'EXAM':
        case 'PROGRESS_REPORT':
        case 'ACADEMIC':
          navigate('ParentAcademics', { childId: studentId, examId: entityId });
          break;
        case 'FEE':
          navigate('ParentFees', { childId: studentId, paymentId: entityId });
          break;
        case 'FEEDBACK':
        case 'MESSAGE':
          navigate('ParentFeedback', { reviewId: entityId });
          break;
        default:
          navigate('ParentNotifications');
          break;
      }
      break;
    }

    case 'STAFF':
    case 'ACADEMIC_ADMIN':
    case 'BRANCH_ADMIN':
    case 'FRANCHISE_OWNER':
    case 'SUPER_ADMIN': {
      // If batchId is present, validate and select batch context
      if (batchId) {
        const { batches, setSelectedBatch } = useTeacherStore.getState();
        const matchedBatch = batches.find((b) => b.id === batchId);
        if (matchedBatch) {
          setSelectedBatch(matchedBatch);
        }
      }

      switch (entityType) {
        case 'HOMEWORK':
        case 'HOMEWORK_SUBMISSION':
          navigate('HomeworkSubmissions', {
            homeworkId: entityId || payload.homeworkId,
          });
          break;
        case 'ATTENDANCE':
          navigate('TeacherAttendance', { batchId });
          break;
        case 'MATERIAL':
          navigate('TeacherMaterials', { materialId: entityId });
          break;
        case 'TIMETABLE':
          navigate('TeacherTimetable');
          break;
        case 'PROGRESS_REPORT':
        case 'ACADEMIC':
          navigate('TeacherProgress', { studentId });
          break;
        default:
          navigate('TeacherNotifications');
          break;
      }
      break;
    }

    default:
      console.warn('[DeepLink] Unrecognized active role:', activeRole);
  }
}
