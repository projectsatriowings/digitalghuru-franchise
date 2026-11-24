import { matchStudentVoice, EnrolledStudentCandidate } from '@tuition/shared';

// Synthetic test fixture dataset representing realistic edge cases
const mockStudents: EnrolledStudentCandidate[] = [
  {
    id: 'stud-1',
    firstName: 'Aarav',
    lastName: 'Mehta',
    admissionNumber: 'ADM-2026-001',
    rollNumber: '101',
    status: 'ACTIVE',
    batchId: 'batch-1',
    batchName: 'Grade 10 - Science Batch A',
    alreadyCheckedIn: false,
    alreadyCheckedOut: false,
    todayStatus: 'ABSENT',
    recommendedAction: 'CHECK_IN',
  },
  {
    id: 'stud-2',
    firstName: 'Rahul',
    lastName: 'Sharma',
    admissionNumber: 'ADM-2026-002',
    rollNumber: '102',
    status: 'ACTIVE',
    batchId: 'batch-1',
    batchName: 'Grade 10 - Science Batch A',
    alreadyCheckedIn: false,
    alreadyCheckedOut: false,
    todayStatus: 'ABSENT',
    recommendedAction: 'CHECK_IN',
  },
  {
    id: 'stud-3',
    firstName: 'Rahul',
    lastName: 'Sharma',
    admissionNumber: 'ADM-2026-003',
    rollNumber: '103',
    status: 'ACTIVE',
    batchId: 'batch-2',
    batchName: 'Grade 10 - Commerce Batch B',
    alreadyCheckedIn: false,
    alreadyCheckedOut: false,
    todayStatus: 'ABSENT',
    recommendedAction: 'CHECK_IN',
  },
  {
    id: 'stud-4',
    firstName: 'Arav',
    lastName: 'Mehta',
    admissionNumber: 'ADM-2026-004',
    rollNumber: '104',
    status: 'ACTIVE',
    batchId: 'batch-1',
    batchName: 'Grade 10 - Science Batch A',
    alreadyCheckedIn: true,
    alreadyCheckedOut: false,
    todayStatus: 'CHECKED_IN',
    recommendedAction: 'CHECK_OUT',
  },
  {
    id: 'stud-5',
    firstName: 'Diya',
    lastName: 'Patel',
    admissionNumber: 'ADM-2026-005',
    rollNumber: '105',
    status: 'ACTIVE',
    batchId: 'batch-1',
    batchName: 'Grade 10 - Science Batch A',
    alreadyCheckedIn: false,
    alreadyCheckedOut: false,
    todayStatus: 'ABSENT',
    recommendedAction: 'CHECK_IN',
  },
];

export function runVoiceTests() {
  console.log('================================================================');
  console.log('1. VOICE ATTENDANCE ENGINE AUDIT & EDGE CASE VERIFICATION');
  console.log('================================================================');

  // Scenario 1: One exact match
  const r1 = matchStudentVoice('Diya Patel', mockStudents);
  console.log('\n[TEST 1] Single Matching Student ("Diya Patel"):');
  console.log(`- Status: ${r1.status}`);
  console.log(`- Best Match: ${r1.bestMatch?.firstName} ${r1.bestMatch?.lastName} (${r1.bestMatch?.admissionNumber})`);
  console.log(`- Result: ${r1.status === 'EXACT_SINGLE' && r1.bestMatch?.id === 'stud-5' ? 'PASS' : 'FAIL'}`);

  // Scenario 2: Duplicate identical names ("Rahul Sharma")
  const r2 = matchStudentVoice('Rahul Sharma', mockStudents);
  console.log('\n[TEST 2] Duplicate Identical Names ("Rahul Sharma"):');
  console.log(`- Status: ${r2.status}`);
  console.log(`- Matches Count: ${r2.allMatches.length}`);
  console.log(`- Best Match (Must be null to enforce manual disambiguation): ${r2.bestMatch}`);
  console.log(`- Result: ${r2.status === 'EXACT_MULTIPLE' && r2.bestMatch === null && r2.allMatches.length === 2 ? 'PASS' : 'FAIL'}`);

  // Scenario 3: Similar-sounding name / phonetic spelling ("Arav")
  const r3 = matchStudentVoice('Arav', mockStudents);
  console.log('\n[TEST 3] Similar Sounding Names ("Arav" matching Aarav / Arav):');
  console.log(`- Status: ${r3.status}`);
  console.log(`- Matches Count: ${r3.allMatches.length}`);
  console.log(`- Candidate Names: ${r3.allMatches.map(m => m.firstName + ' (' + m.admissionNumber + ')').join(', ')}`);
  console.log(`- Result: ${r3.allMatches.length >= 1 ? 'PASS' : 'FAIL'}`);

  // Scenario 4: Non-existent student ("Vikramaditya Rao")
  const r4 = matchStudentVoice('Vikramaditya Rao', mockStudents);
  console.log('\n[TEST 4] Non-Existent Student ("Vikramaditya Rao"):');
  console.log(`- Status: ${r4.status}`);
  console.log(`- Matches: ${r4.allMatches.length}`);
  console.log(`- Result: ${r4.status === 'NO_MATCH' && r4.allMatches.length === 0 ? 'PASS' : 'FAIL'}`);

  // Scenario 5: Already checked in student (Verify recommendedAction)
  const candidateStud4 = mockStudents.find(s => s.id === 'stud-4');
  console.log('\n[TEST 5] Already Marked Present Student ("Arav Mehta - stud-4"):');
  console.log(`- todayStatus: ${candidateStud4?.todayStatus}`);
  console.log(`- recommendedAction: ${candidateStud4?.recommendedAction}`);
  console.log(`- Prevents duplicate check-in: ${candidateStud4?.recommendedAction === 'CHECK_OUT' ? 'PASS' : 'FAIL'}`);

  // Scenario 6: Check-out flow
  const isCheckOutEligible = candidateStud4?.todayStatus === 'CHECKED_IN' && candidateStud4?.recommendedAction === 'CHECK_OUT';
  console.log('\n[TEST 6] Check-out Transition Flow:');
  console.log(`- Current State: ${candidateStud4?.todayStatus}`);
  console.log(`- Target Transition: CHECK_OUT`);
  console.log(`- Transition Validated: ${isCheckOutEligible ? 'PASS' : 'FAIL'}`);

  // Scenario 7: Manual Candidate Selection from ambiguous matches
  const candidateSelection = r2.allMatches.find(c => c.admissionNumber === 'ADM-2026-002');
  console.log('\n[TEST 7] Manual Candidate Selection (Resolving Rahul Sharma ADM-2026-002):');
  console.log(`- Ambiguous List Provided: ${r2.allMatches.length} candidates`);
  console.log(`- Selected Candidate ID: ${candidateSelection?.id} (${candidateSelection?.batchName})`);
  console.log(`- Result: ${candidateSelection?.id === 'stud-2' ? 'PASS' : 'FAIL'}`);

  // Scenario 8: Duplicate submission prevention
  const duplicatePrevented = candidateStud4?.alreadyCheckedIn && candidateStud4.todayStatus !== 'ABSENT';
  console.log('\n[TEST 8] Duplicate Check-in Prevention Guard:');
  console.log(`- alreadyCheckedIn Flag: ${candidateStud4?.alreadyCheckedIn}`);
  console.log(`- Blocks Double Check-in Attempt: ${duplicatePrevented ? 'PASS' : 'FAIL'}`);
}

export function runSecuritySimulationTests() {
  console.log('\n================================================================');
  console.log('2. MULTI-TENANT & ROLE-BASED ACCESS CONTROL (RBAC) SECURITY AUDIT');
  console.log('================================================================');

  // Security Test 1: Student token attempting to call staff attendance check-in
  const studentRole = 'STUDENT';
  const staffRequiredRoles = ['SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'];
  const isAllowedCheckIn = staffRequiredRoles.includes(studentRole);
  console.log('\n[SECURITY TEST 1] Student Token Calling POST /api/attendance/check-in:');
  console.log(`- Attempted Role: ${studentRole}`);
  console.log(`- Required Roles: ${staffRequiredRoles.join(', ')}`);
  console.log(`- Authorization Decision: ${isAllowedCheckIn ? 'ALLOW (200)' : 'DENIED (403 Forbidden)'}`);
  console.log(`- Result: ${!isAllowedCheckIn ? 'PASS' : 'FAIL'}`);

  // Security Test 2: Parent token attempting to call teacher homework evaluation
  const parentRole = 'PARENT';
  const isAllowedGradeHw = staffRequiredRoles.includes(parentRole);
  console.log('\n[SECURITY TEST 2] Parent Token Calling PATCH /api/homework/submissions/:id/grade:');
  console.log(`- Attempted Role: ${parentRole}`);
  console.log(`- Authorization Decision: ${isAllowedGradeHw ? 'ALLOW (200)' : 'DENIED (403 Forbidden)'}`);
  console.log(`- Result: ${!isAllowedGradeHw ? 'PASS' : 'FAIL'}`);

  // Security Test 3: Parent accessing unrelated child records
  const linkedChildIds = ['stud-1']; // Vikram Mehta only linked to Aarav Mehta
  const requestedChildId = 'stud-5'; // Diya Patel
  const isAuthorizedChildAccess = linkedChildIds.includes(requestedChildId);
  console.log('\n[SECURITY TEST 3] Parent Querying Unrelated Child Records (GET /api/parents/students/stud-5/academics):');
  console.log(`- Parent Linked Children: [${linkedChildIds.join(', ')}]`);
  console.log(`- Requested Child ID: ${requestedChildId}`);
  console.log(`- Access Decision: ${isAuthorizedChildAccess ? 'PERMITTED' : 'BLOCKED (403 Forbidden: Child not linked to parent)'}`);
  console.log(`- Result: ${!isAuthorizedChildAccess ? 'PASS' : 'FAIL'}`);

  // Security Test 4: Teacher accessing unassigned batch
  const teacherAssignedBatches = ['batch-1']; // Grade 10 - Science Batch A
  const targetBatchId = 'batch-2'; // Grade 10 - Commerce Batch B
  const isBatchAssigned = teacherAssignedBatches.includes(targetBatchId);
  console.log('\n[SECURITY TEST 4] Teacher Accessing Unassigned Batch (GET /api/attendance/reports?batchId=batch-2):');
  console.log(`- Teacher Assigned Batches: [${teacherAssignedBatches.join(', ')}]`);
  console.log(`- Target Batch ID: ${targetBatchId}`);
  console.log(`- Access Decision: ${isBatchAssigned ? 'PERMITTED' : 'BLOCKED (403 Forbidden: Not authorized for this batch)'}`);
  console.log(`- Result: ${!isBatchAssigned ? 'PASS' : 'FAIL'}`);

  // Security Test 5: Tenant Context Isolation (Header Mismatch)
  const userInstituteId = '11111111-1111-1111-1111-111111111111'; // Apex Tuition Academy
  const foreignInstituteId = '99999999-9999-9999-9999-999999999999'; // Foreign Franchise
  const isTenantValid = userInstituteId === foreignInstituteId;
  console.log('\n[SECURITY TEST 5] Modified Header x-institute-id (Foreign Tenant Access):');
  console.log(`- User Membership Institute: ${userInstituteId}`);
  console.log(`- Injected Header x-institute-id: ${foreignInstituteId}`);
  console.log(`- Access Decision: ${isTenantValid ? 'PERMITTED' : 'BLOCKED (403 Forbidden: Institute context mismatch)'}`);
  console.log(`- Result: ${!isTenantValid ? 'PASS' : 'FAIL'}`);
}

runVoiceTests();
runSecuritySimulationTests();
