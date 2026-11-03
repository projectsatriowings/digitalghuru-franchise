import { Prisma, PrismaClient } from '@prisma/client';

export const DEFAULT_SERIAL_WIDTH = 3;
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Format compact 7-character admission number according to:
 * [INSTITUTE 2-CHAR][BATCH 2-CHAR][SERIAL 3-CHAR]
 * Example: A102001
 * Expands naturally to 8 characters if serial exceeds 999 (e.g. A1021000)
 */
export function formatCompactAdmissionNumber(
  instituteCode: string,
  batchCode: string,
  serial: number,
  minSerialWidth = DEFAULT_SERIAL_WIDTH
): string {
  const cleanInst = (instituteCode || 'IN').slice(0, 2).toUpperCase().padEnd(2, '1');
  const cleanBatch = (batchCode || '00').slice(0, 2).toUpperCase().padStart(2, '0');
  const serialStr = String(serial).padStart(minSerialWidth, '0');
  return `${cleanInst}${cleanBatch}${serialStr}`;
}

/**
 * Derive the admission year based on Asia/Kolkata timezone
 */
export function getAdmissionYear(dateInput?: Date | string | null, timeZone = DEFAULT_TIMEZONE): number {
  const date = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(date.getTime()) ? new Date() : date;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
  });
  return parseInt(formatter.format(validDate), 10);
}

/**
 * Derive a 2-character batch code deterministically.
 * Uses batch code or grade/batch digits if available, falling back to batch sequence index.
 * Example: "Class 10" -> "10", "Batch 02" -> "02", "G10-EXC" -> "10", unassigned -> "00"
 */
export function deriveBatchCode(
  batch?: { code?: string | null; name?: string; id?: string } | null,
  batchIndex: number = 0
): string {
  if (!batch) {
    return '00';
  }

  // 1. If batch.code is explicitly 2 alphanumeric characters
  if (batch.code) {
    const clean = batch.code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean.length === 2) {
      return clean;
    }
    // Check if code contains 2 consecutive digits, e.g. "G10-EXC" -> "10", "B-10A" -> "10"
    const digitMatch = clean.match(/\d{2}/);
    if (digitMatch) {
      return digitMatch[0];
    }
  }

  // 2. Check if batch.name has a 1- or 2-digit number (e.g. "Class 10" -> "10", "Batch 2" -> "02")
  if (batch.name) {
    const nameMatch = batch.name.match(/\b(\d{1,2})\b/);
    if (nameMatch) {
      return nameMatch[1].padStart(2, '0');
    }
  }

  // 3. Fallback: 1-based sequential batch index in institute
  const idx = batchIndex + 1;
  if (idx < 100) {
    return String(idx).padStart(2, '0');
  }
  // Base-36 representation if > 99
  return idx.toString(36).toUpperCase().padStart(2, '0').slice(-2);
}

/**
 * Get or establish a stable, unique 2-character compact institute identifier.
 * Persists in institute.settingsJson.compactCode while preserving any historical admissionPrefix.
 * Ensures zero collision across all institutes.
 */
export async function getOrSetCompactInstituteCode(
  db: PrismaClient | Prisma.TransactionClient,
  instituteId: string
): Promise<string> {
  const institute = await db.institute.findUnique({
    where: { id: instituteId },
    select: { id: true, name: true, code: true, settingsJson: true, admissionPrefix: true },
  });

  if (!institute) {
    throw new Error(`Institute not found for ID: ${instituteId}`);
  }

  // 1. If compact code is already persisted in settingsJson, return it immediately
  const settings = (institute.settingsJson as any) || {};
  if (settings.compactCode && typeof settings.compactCode === 'string') {
    return settings.compactCode.toUpperCase();
  }

  // 2. If existing admissionPrefix is exactly 2 characters, reuse it
  if (institute.admissionPrefix && institute.admissionPrefix.length === 2) {
    const code = institute.admissionPrefix.toUpperCase();
    await db.institute.update({
      where: { id: instituteId },
      data: {
        settingsJson: {
          ...settings,
          compactCode: code,
        },
      },
    });
    return code;
  }

  // 3. Derive 2-character candidate: First letter of name/code + sequential suffix
  const cleanName = (institute.name || institute.code || 'INST')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const letter = cleanName.charAt(0) || 'A';

  // Gather existing compact codes across all other institutes
  const allInstitutes = await db.institute.findMany({
    where: { id: { not: instituteId } },
    select: { settingsJson: true },
  });

  const usedCodes = new Set<string>();
  for (const inst of allInstitutes) {
    const instSettings = (inst.settingsJson as any) || {};
    if (instSettings.compactCode) {
      usedCodes.add(String(instSettings.compactCode).toUpperCase());
    }
  }

  // Deterministically find the next unused candidate: e.g. A1, A2, ... A9, AA, AB...
  const suffixes = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let candidate = `${letter}1`;
  let suffixIdx = 0;

  while (usedCodes.has(candidate)) {
    suffixIdx++;
    if (suffixIdx < suffixes.length) {
      candidate = `${letter}${suffixes[suffixIdx]}`;
    } else {
      candidate = `${letter}${suffixIdx}`;
    }
  }

  // Persist the compact code into settingsJson without disturbing existing admissionPrefix
  await db.institute.update({
    where: { id: instituteId },
    data: {
      settingsJson: {
        ...settings,
        compactCode: candidate,
      },
    },
  });

  return candidate;
}

/**
 * Concurrency-safe atomic generation of the next stable student admission number.
 * Scheme: [INSTITUTE 2-CHAR][BATCH 2-CHAR][SERIAL 3-CHAR] (e.g. A102001)
 * Must be executed within a database transaction.
 */
export async function generateNextAdmissionNumber(
  tx: Prisma.TransactionClient,
  instituteId: string,
  batchIdOrDate?: string | Date | null,
  admissionDateInput?: Date | string | null,
  minSerialWidth = DEFAULT_SERIAL_WIDTH
): Promise<{
  admissionNumber: string;
  year: number;
  serial: number;
  prefix: string;
  compactInstitute: string;
  batchCode: string;
}> {
  // Disambiguate arguments: batchId vs admissionDate
  let batchId: string | null = null;
  let effectiveDate: Date | string | null = admissionDateInput || null;

  if (typeof batchIdOrDate === 'string') {
    // Check if it is a UUID or batch identifier (not an ISO date string)
    if (!batchIdOrDate.includes('T') && !batchIdOrDate.match(/^\d{4}-\d{2}-\d{2}/)) {
      batchId = batchIdOrDate;
    } else if (!effectiveDate) {
      effectiveDate = batchIdOrDate;
    }
  } else if (batchIdOrDate instanceof Date) {
    effectiveDate = batchIdOrDate;
  }

  // 1. Get or establish permanent 2-character institute code (e.g. 'A1')
  const compactInstitute = await getOrSetCompactInstituteCode(tx, instituteId);

  // 2. Derive 2-character batch code (e.g. '02' or '00' if unassigned)
  let batchCode = '00';
  if (batchId) {
    const batch = await tx.batch.findFirst({
      where: { id: batchId, instituteId },
    });
    if (batch) {
      const instituteBatches = await tx.batch.findMany({
        where: { instituteId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      const batchIndex = instituteBatches.findIndex((b) => b.id === batchId);
      batchCode = deriveBatchCode(batch, Math.max(0, batchIndex));
    }
  }

  // 3. Determine admission year in Asia/Kolkata
  const year = getAdmissionYear(effectiveDate);

  // 4. Atomically upsert sequence counter (row-locked in PostgreSQL)
  const sequence = await tx.admissionSequence.upsert({
    where: {
      instituteId_year: {
        instituteId,
        year,
      },
    },
    create: {
      instituteId,
      year,
      lastSerial: 1,
    },
    update: {
      lastSerial: {
        increment: 1,
      },
    },
  });

  let serial = sequence.lastSerial;
  let admissionNumber = formatCompactAdmissionNumber(compactInstitute, batchCode, serial, minSerialWidth);

  // 5. Check uniqueness against any legacy or manual records in the institute
  while (
    await tx.student.findUnique({
      where: {
        instituteId_admissionNumber: {
          instituteId,
          admissionNumber,
        },
      },
      select: { id: true },
    })
  ) {
    const advanced = await tx.admissionSequence.update({
      where: {
        instituteId_year: {
          instituteId,
          year,
        },
      },
      data: {
        lastSerial: {
          increment: 1,
        },
      },
    });

    serial = advanced.lastSerial;
    admissionNumber = formatCompactAdmissionNumber(compactInstitute, batchCode, serial, minSerialWidth);
  }

  return {
    admissionNumber,
    year,
    serial,
    prefix: compactInstitute,
    compactInstitute,
    batchCode,
  };
}

/**
 * Legacy compatibility export for existing tests
 */
export async function getOrSetInstitutePrefix(
  db: PrismaClient | Prisma.TransactionClient,
  instituteId: string
): Promise<string> {
  return getOrSetCompactInstituteCode(db, instituteId);
}
