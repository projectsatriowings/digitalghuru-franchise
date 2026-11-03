import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { QuestionPaperRecord } from './question-generator.types.js';

const STORAGE_ROOT = path.resolve(process.cwd(), 'uploads', 'question_papers');

// Ensure base question paper storage directory exists
if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

function getInstitutePaperDir(instituteId: string): string {
  const safeId = instituteId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(STORAGE_ROOT, safeId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getIndexFilePath(instituteId: string): string {
  return path.join(getInstitutePaperDir(instituteId), 'papers-index.json');
}

function readInstituteIndex(instituteId: string): Record<string, QuestionPaperRecord> {
  const file = getIndexFilePath(instituteId);
  if (!fs.existsSync(file)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[PaperStorage] Error reading index for institute ${instituteId}:`, err);
    return {};
  }
}

function writeInstituteIndex(instituteId: string, data: Record<string, QuestionPaperRecord>): void {
  const file = getIndexFilePath(instituteId);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

export class QuestionPaperStorageService {
  /**
   * Save a new question paper record (or update existing)
   */
  static savePaper(instituteId: string, record: QuestionPaperRecord): QuestionPaperRecord {
    const index = readInstituteIndex(instituteId);
    record.updatedAt = new Date().toISOString();
    if (!record.createdAt) {
      record.createdAt = record.updatedAt;
    }
    index[record.id] = record;
    writeInstituteIndex(instituteId, index);
    return record;
  }

  /**
   * List papers for a specific institute (with optional status filter)
   */
  static listPapers(
    instituteId: string,
    filter?: { status?: string; subject?: string }
  ): QuestionPaperRecord[] {
    const index = readInstituteIndex(instituteId);
    let list = Object.values(index);

    if (filter?.status) {
      list = list.filter((p) => p.status === filter.status);
    }
    if (filter?.subject) {
      list = list.filter((p) => p.subject.toLowerCase().includes(filter.subject!.toLowerCase()));
    }

    // Sort descending by updatedAt
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Retrieve a specific paper by ID for the institute
   */
  static getPaperById(instituteId: string, paperId: string): QuestionPaperRecord | null {
    const index = readInstituteIndex(instituteId);
    return index[paperId] || null;
  }

  /**
   * Delete a paper
   */
  static deletePaper(instituteId: string, paperId: string): boolean {
    const index = readInstituteIndex(instituteId);
    if (!index[paperId]) return false;
    delete index[paperId];
    writeInstituteIndex(instituteId, index);
    return true;
  }

  /**
   * Duplicate a paper as a new DRAFT
   */
  static duplicatePaper(
    instituteId: string,
    sourcePaperId: string,
    newCreatedById: string
  ): QuestionPaperRecord | null {
    const source = this.getPaperById(instituteId, sourcePaperId);
    if (!source) return null;

    const newId = `qp-${crypto.randomUUID()}`;
    const timestamp = new Date().toISOString();

    const duplicated: QuestionPaperRecord = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      title: `${source.title} (Copy)`,
      status: 'DRAFT',
      createdById: newCreatedById,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return this.savePaper(instituteId, duplicated);
  }
}
