export interface EnrolledStudentCandidate {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    rollNumber?: string | null;
    phone?: string | null;
    photoUrl?: string | null;
    status?: string;
    batchId?: string;
    batchName?: string;
    subjectId?: string | null;
    subjectName?: string | null;
    alreadyCheckedIn?: boolean;
    alreadyCheckedOut?: boolean;
    checkInTimeFormatted?: string | null;
    checkOutTimeFormatted?: string | null;
    todayStatus?: string;
    recommendedAction?: 'CHECK_IN' | 'CHECK_OUT' | 'COMPLETED';
}
export interface VoiceMatchResult {
    exactMatches: EnrolledStudentCandidate[];
    fuzzyMatches: Array<{
        student: EnrolledStudentCandidate;
        score: number;
    }>;
    allMatches?: EnrolledStudentCandidate[];
    bestMatch: EnrolledStudentCandidate | null;
    status: 'EXACT_SINGLE' | 'EXACT_MULTIPLE' | 'FUZZY_SINGLE' | 'FUZZY_MULTIPLE' | 'NO_MATCH';
    cleanedQuery: string;
}
/**
 * Normalizes speech input by trimming whitespace, removing punctuation,
 * and filtering common attendance verbal noise (e.g., "present", "here sir", "roll no").
 */
export declare function normalizeSpeechTranscript(raw: string): string;
/**
 * Standard Levenshtein distance implementation
 */
export declare function levenshteinDistance(a: string, b: string): number;
/**
 * Calculates normalized string similarity ratio between 0.0 and 1.0
 */
export declare function calculateSimilarity(s1: string, s2: string): number;
/**
 * Phonetically normalizes common name spelling variations (Indian English & speech recognition).
 * E.g., Sangeeta <-> Sangeetha, Kabeer <-> Kabir, Pooja <-> Puja, Aarav <-> Arav, etc.
 */
export declare function normalizePhonetic(name: string): string;
/**
 * Calculates a match score between the spoken query and a candidate student.
 * Returns score between 0.0 and 1.0, plus match tier information.
 */
export declare function scoreCandidateMatch(cleanedQuery: string, candidate: EnrolledStudentCandidate): {
    score: number;
    isExactFull: boolean;
    isExactToken: boolean;
    isPhonetic: boolean;
};
/**
 * Matches a spoken or typed transcript against enrolled students in an active batch.
 * Guarantees strict safety:
 * - Prioritizes exact full-name matches, then token matches, then phonetic/fuzzy matches.
 * - Ranks candidates by matching relevance without discarding qualifying candidates.
 * - Never auto-selects ambiguous / multiple matches.
 * - Preserves all qualifying matches (score >= 0.70).
 */
export declare function matchStudentVoice(spokenTranscript: string, enrolledStudents: EnrolledStudentCandidate[], threshold?: number): VoiceMatchResult;
//# sourceMappingURL=voiceMatching.d.ts.map