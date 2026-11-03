import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Extract a clean, professional uppercase academy prefix from institute details.
 * E.g., 'Apex Tuition Academy' -> 'APEX'
 *       'Oxford Learning Center' -> 'OXFORD'
 *       'St. Xavier Tuition' -> 'STXAVIER'
 */
export function getAcademyPrefix(institute: {
  name: string;
  code?: string | null;
  admissionPrefix?: string | null;
}): string {
  // If an admissionPrefix was already set or customized, use it as primary authority
  if (institute.admissionPrefix && institute.admissionPrefix.trim()) {
    return institute.admissionPrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  const name = institute.name || institute.code || 'INST';
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);

  const genericWords = new Set([
    'THE',
    'OF',
    'FOR',
    'AND',
    'IN',
    'AT',
    'AN',
    'A',
    'TUITION',
    'ACADEMY',
    'INSTITUTE',
    'CLASSES',
    'COACHING',
    'CENTRE',
    'CENTER',
    'SCHOOL',
  ]);
  const nonGeneric = words.filter((w) => !genericWords.has(w));
  const effective = nonGeneric.length > 0 ? nonGeneric : words;

  const first = effective[0];
  if (first.length >= 3) {
    return first.slice(0, 8);
  }
  if (effective.length >= 2) {
    return (first + effective[1]).slice(0, 8);
  }

  // Fallback to institute code or first 4-6 chars
  const fromCode = (institute.code || '').replace(/[^A-Z0-9]/g, '');
  if (fromCode.length >= 3) {
    return fromCode.slice(0, 8);
  }

  return (first || 'INST').toUpperCase().slice(0, 8);
}

/**
 * Generate next sequential employee code for an institute in format:
 * {ACADEMY_PREFIX}-EMP-{SERIAL} (e.g. APEX-EMP-001, APEX-EMP-002, etc.)
 */
export async function generateNextEmployeeCode(
  db: PrismaClient | Prisma.TransactionClient,
  instituteId: string
): Promise<string> {
  const institute = await db.institute.findUnique({
    where: { id: instituteId },
    select: { id: true, name: true, code: true, admissionPrefix: true },
  });

  if (!institute) {
    throw new Error(`Institute not found for ID: ${instituteId}`);
  }

  const prefix = getAcademyPrefix(institute);
  const pattern = `${prefix}-EMP-`;

  // Fetch all existing employee codes for this institute
  const existingStaff = await db.staffProfile.findMany({
    where: { instituteId },
    select: { employeeCode: true },
  });

  let maxNum = 0;
  for (const staff of existingStaff) {
    if (!staff.employeeCode) continue;
    const code = staff.employeeCode.trim().toUpperCase();
    if (code.startsWith(pattern)) {
      const numPart = parseInt(code.slice(pattern.length), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    } else if (code.startsWith('EMP-')) {
      const numPart = parseInt(code.slice(4), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
  }

  const nextNumber = maxNum + 1;
  const serialStr = String(nextNumber).padStart(3, '0');
  return `${prefix}-EMP-${serialStr}`;
}
