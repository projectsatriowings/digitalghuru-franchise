import { getCanonicalStudentHomeworkStatus } from '../src/modules/homework/homework.controller.js';

console.log('====================================================');
console.log(' TUITIONOS PHASE 8 — CANONICAL STATUS & DB TESTS    ');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, desc: string) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${desc}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${desc}`);
    process.exitCode = 1;
  }
}

// 1. Not Started - Future Due Date
const futureDate = new Date(Date.now() + 86400000 * 3); // +3 days
const status1 = getCanonicalStudentHomeworkStatus(futureDate, null);
assert(status1.studentStatus === 'NOT_STARTED', 'Future unsubmitted assignment has status NOT_STARTED');
assert(status1.isPending === true, 'Future unsubmitted assignment is marked isPending=true');
assert(status1.isOverdue === false, 'Future unsubmitted assignment is not overdue');
assert(status1.isSubmitted === false, 'Future unsubmitted assignment is not submitted');

// 2. Overdue - Past Due Date, No Submission
const pastDate = new Date(Date.now() - 86400000 * 2); // -2 days
const status2 = getCanonicalStudentHomeworkStatus(pastDate, null);
assert(status2.studentStatus === 'OVERDUE', 'Past due unsubmitted assignment has status OVERDUE');
assert(status2.isOverdue === true, 'Past due unsubmitted assignment is marked isOverdue=true');
assert(status2.isPending === true, 'Past due unsubmitted assignment is pending student action');

// 3. Submitted / Awaiting Review - Past Due Date but has submission
const status3 = getCanonicalStudentHomeworkStatus(pastDate, { status: 'SUBMITTED', grade: null });
assert(status3.studentStatus === 'AWAITING_REVIEW', 'Submitted assignment past deadline has status AWAITING_REVIEW');
assert(status3.isSubmitted === true, 'Submitted assignment past deadline is marked isSubmitted=true');
assert(status3.isOverdue === false, 'CRITICAL: Submitted assignment past deadline is NEVER marked overdue');
assert(status3.isPending === false, 'Submitted assignment is not pending student action');

// 4. Graded Submission - Retains saved grade (e.g. 10)
const status4 = getCanonicalStudentHomeworkStatus(pastDate, { status: 'GRADED', grade: '10' });
assert(status4.studentStatus === 'GRADED', 'Graded assignment has status GRADED');
assert(status4.displayStatus === 'Graded (10)', 'Graded assignment displays formatted grade "Graded (10)"');
assert(status4.isGraded === true, 'Graded assignment is marked isGraded=true');
assert(status4.isCompleted === true, 'Graded assignment is marked isCompleted=true');
assert(status4.isOverdue === false, 'Graded assignment is not overdue');

// 5. Self-Completed Submission
const status5 = getCanonicalStudentHomeworkStatus(futureDate, { status: 'COMPLETED', grade: null });
assert(status5.studentStatus === 'COMPLETED', 'Self-completed assignment has status COMPLETED');
assert(status5.isCompleted === true, 'Self-completed assignment is marked isCompleted=true');
assert(status5.isSubmitted === true, 'Self-completed assignment is marked isSubmitted=true');
assert(status5.isPending === false, 'Self-completed assignment is not pending');

// 6. Null Due Date (Open Assignment)
const status6 = getCanonicalStudentHomeworkStatus(null, null);
assert(status6.studentStatus === 'NOT_STARTED', 'Open assignment with null due date defaults to NOT_STARTED');
assert(status6.isOverdue === false, 'Open assignment with null due date is not overdue');

// 7. Late Submission
const status7 = getCanonicalStudentHomeworkStatus(pastDate, { status: 'LATE', grade: null });
assert(status7.studentStatus === 'AWAITING_REVIEW', 'Late submitted assignment is categorized as AWAITING_REVIEW');
assert(status7.isOverdue === false, 'Late submitted assignment is not overdue');

console.log(`\n====================================================`);
console.log(` RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log(`====================================================`);
