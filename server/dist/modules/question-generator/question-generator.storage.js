"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionPaperStorageService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const STORAGE_ROOT = path_1.default.resolve(process.cwd(), 'uploads', 'question_papers');
// Ensure base question paper storage directory exists
if (!fs_1.default.existsSync(STORAGE_ROOT)) {
    fs_1.default.mkdirSync(STORAGE_ROOT, { recursive: true });
}
function getInstitutePaperDir(instituteId) {
    const safeId = instituteId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const dir = path_1.default.join(STORAGE_ROOT, safeId);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    return dir;
}
function getIndexFilePath(instituteId) {
    return path_1.default.join(getInstitutePaperDir(instituteId), 'papers-index.json');
}
function readInstituteIndex(instituteId) {
    const file = getIndexFilePath(instituteId);
    if (!fs_1.default.existsSync(file)) {
        return {};
    }
    try {
        const raw = fs_1.default.readFileSync(file, 'utf-8');
        return JSON.parse(raw);
    }
    catch (err) {
        console.warn(`[PaperStorage] Error reading index for institute ${instituteId}:`, err);
        return {};
    }
}
function writeInstituteIndex(instituteId, data) {
    const file = getIndexFilePath(instituteId);
    fs_1.default.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}
class QuestionPaperStorageService {
    /**
     * Save a new question paper record (or update existing)
     */
    static savePaper(instituteId, record) {
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
    static listPapers(instituteId, filter) {
        const index = readInstituteIndex(instituteId);
        let list = Object.values(index);
        if (filter?.status) {
            list = list.filter((p) => p.status === filter.status);
        }
        if (filter?.subject) {
            list = list.filter((p) => p.subject.toLowerCase().includes(filter.subject.toLowerCase()));
        }
        // Sort descending by updatedAt
        return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    /**
     * Retrieve a specific paper by ID for the institute
     */
    static getPaperById(instituteId, paperId) {
        const index = readInstituteIndex(instituteId);
        return index[paperId] || null;
    }
    /**
     * Delete a paper
     */
    static deletePaper(instituteId, paperId) {
        const index = readInstituteIndex(instituteId);
        if (!index[paperId])
            return false;
        delete index[paperId];
        writeInstituteIndex(instituteId, index);
        return true;
    }
    /**
     * Duplicate a paper as a new DRAFT
     */
    static duplicatePaper(instituteId, sourcePaperId, newCreatedById) {
        const source = this.getPaperById(instituteId, sourcePaperId);
        if (!source)
            return null;
        const newId = `qp-${crypto_1.default.randomUUID()}`;
        const timestamp = new Date().toISOString();
        const duplicated = {
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
exports.QuestionPaperStorageService = QuestionPaperStorageService;
