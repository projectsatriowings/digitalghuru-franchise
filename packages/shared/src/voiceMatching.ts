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
  fuzzyMatches: Array<{ student: EnrolledStudentCandidate; score: number }>;
  allMatches?: EnrolledStudentCandidate[];
  bestMatch: EnrolledStudentCandidate | null;
  status: 'EXACT_SINGLE' | 'EXACT_MULTIPLE' | 'FUZZY_SINGLE' | 'FUZZY_MULTIPLE' | 'NO_MATCH';
  cleanedQuery: string;
}

/**
 * Normalizes speech input by trimming whitespace, removing punctuation,
 * and filtering common attendance verbal noise (e.g., "present", "here sir", "roll no").
 */
export function normalizeSpeechTranscript(raw: string): string {
  if (!raw) return '';
  let cleaned = raw
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip noise words when accompanied by a name
  const noiseWords = [
    'present',
    'here',
    'sir',
    'madam',
    'maam',
    'mam',
    'yes',
    'please',
    'mark',
    'attendance',
    'roll no',
    'roll number',
    'roll',
    'is present',
    'is here',
  ];

  for (const noise of noiseWords) {
    const regex = new RegExp(`\\b${noise}\\b`, 'gi');
    cleaned = cleaned.replace(regex, ' ').replace(/\s+/g, ' ').trim();
  }

  return cleaned;
}

/**
 * Standard Levenshtein distance implementation
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[bn][an];
}

/**
 * Calculates normalized string similarity ratio between 0.0 and 1.0
 */
export function calculateSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1, s2);
  return 1 - dist / maxLen;
}

/**
 * Phonetically normalizes common name spelling variations (Indian English & speech recognition).
 * E.g., Sangeeta <-> Sangeetha, Kabeer <-> Kabir, Pooja <-> Puja, Aarav <-> Arav, etc.
 */
export function normalizePhonetic(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/bh/g, 'b')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/sh/g, 's')
    .replace(/ch/g, 'c')
    .replace(/ee|ea/g, 'i')
    .replace(/oo|ou/g, 'u')
    .replace(/aa/g, 'a')
    .replace(/w/g, 'v')
    .replace(/z/g, 's')
    .replace(/([a-z])\1+/g, '$1') // collapse duplicate letters
    .trim();
}

/**
 * Calculates a match score between the spoken query and a candidate student.
 * Returns score between 0.0 and 1.0, plus match tier information.
 */
export function scoreCandidateMatch(
  cleanedQuery: string,
  candidate: EnrolledStudentCandidate
): { score: number; isExactFull: boolean; isExactToken: boolean; isPhonetic: boolean } {
  const fName = (candidate.firstName || '').trim().toLowerCase();
  const lName = (candidate.lastName || '').trim().toLowerCase();
  const fullName = `${fName} ${lName}`.trim();
  const adm = (candidate.admissionNumber || '').trim().toLowerCase();
  const cleanAdm = normalizeSpeechTranscript(candidate.admissionNumber || '');
  const cleanRoll = normalizeSpeechTranscript(candidate.rollNumber || '');

  const queryNoPunct = cleanedQuery.replace(/\s+/g, '');
  const admNoPunct = adm.replace(/[^a-z0-9]/g, '');

  // 1. Direct Full Matches (Tier 1: 1.0)
  if (
    cleanedQuery === fullName ||
    cleanedQuery === adm ||
    (cleanAdm && cleanedQuery === cleanAdm) ||
    (cleanRoll && cleanedQuery === cleanRoll) ||
    (queryNoPunct.length >= 3 && queryNoPunct === admNoPunct)
  ) {
    return { score: 1.0, isExactFull: true, isExactToken: false, isPhonetic: false };
  }

  // 2. Exact Single-Name / Token Matches (Tier 2: 0.95)
  const nameTokens = fullName.split(/\s+/).filter(Boolean);
  if (
    cleanedQuery === fName ||
    (lName && cleanedQuery === lName) ||
    nameTokens.includes(cleanedQuery)
  ) {
    return { score: 0.95, isExactFull: false, isExactToken: true, isPhonetic: false };
  }

  // 3. Exact Phonetic Matches (Tier 3: 0.90 - 0.92)
  const phoneticQuery = normalizePhonetic(cleanedQuery);
  const phoneticFullName = normalizePhonetic(fullName);
  const phoneticFName = normalizePhonetic(fName);
  const phoneticLName = normalizePhonetic(lName);
  const phoneticTokens = nameTokens.map(normalizePhonetic);

  if (phoneticQuery === phoneticFullName) {
    return { score: 0.92, isExactFull: false, isExactToken: false, isPhonetic: true };
  }

  if (
    phoneticQuery === phoneticFName ||
    (phoneticLName && phoneticQuery === phoneticLName) ||
    phoneticTokens.includes(phoneticQuery)
  ) {
    return { score: 0.90, isExactFull: false, isExactToken: true, isPhonetic: true };
  }

  // If query is very short (1-2 chars), do not perform fuzzy match
  if (cleanedQuery.length <= 2) {
    return { score: 0, isExactFull: false, isExactToken: false, isPhonetic: false };
  }

  // 4. Prefix Matches (e.g. "Sangeeth" matching "Sangeetha")
  let prefixScore = 0;
  if (cleanedQuery.length >= 3) {
    if (fName.startsWith(cleanedQuery)) {
      prefixScore = Math.max(prefixScore, 0.85 + 0.05 * (cleanedQuery.length / Math.max(fName.length, 1)));
    }
    if (fullName.startsWith(cleanedQuery)) {
      prefixScore = Math.max(prefixScore, 0.85 + 0.05 * (cleanedQuery.length / Math.max(fullName.length, 1)));
    }
    if (lName && lName.startsWith(cleanedQuery)) {
      prefixScore = Math.max(prefixScore, 0.82 + 0.05 * (cleanedQuery.length / Math.max(lName.length, 1)));
    }
    // Also check phonetic prefix
    if (phoneticFName.startsWith(phoneticQuery)) {
      prefixScore = Math.max(prefixScore, 0.84 + 0.05 * (phoneticQuery.length / Math.max(phoneticFName.length, 1)));
    }
    if (cleanAdm && cleanAdm.startsWith(cleanedQuery)) {
      prefixScore = Math.max(prefixScore, 0.85 * (cleanedQuery.length / Math.max(cleanAdm.length, 1)));
    }
  }

  // 5. String & Phonetic Fuzzy Similarity (on names, avoiding sequential numeric ID false matches)
  const simFull = calculateSimilarity(cleanedQuery, fullName);
  const simFirst = calculateSimilarity(cleanedQuery, fName);
  const simLast = lName ? calculateSimilarity(cleanedQuery, lName) : 0;

  const pSimFull = calculateSimilarity(phoneticQuery, phoneticFullName);
  const pSimFirst = calculateSimilarity(phoneticQuery, phoneticFName);
  const pSimLast = phoneticLName ? calculateSimilarity(phoneticQuery, phoneticLName) : 0;

  const maxDirectSim = Math.max(simFull, simFirst, simLast);
  const maxPhoneticSim = Math.max(pSimFull, pSimFirst, pSimLast) * 0.95;

  const maxFuzzyScore = Math.max(prefixScore, maxDirectSim, maxPhoneticSim);

  return {
    score: Math.min(maxFuzzyScore, 0.89), // Fuzzy matches cannot exceed 0.89
    isExactFull: false,
    isExactToken: false,
    isPhonetic: maxPhoneticSim > maxDirectSim,
  };
}

/**
 * Matches a spoken or typed transcript against enrolled students in an active batch.
 * Guarantees strict safety:
 * - Prioritizes exact full-name matches, then token matches, then phonetic/fuzzy matches.
 * - Ranks candidates by matching relevance without discarding qualifying candidates.
 * - Never auto-selects ambiguous / multiple matches.
 * - Preserves all qualifying matches (score >= 0.70).
 */
export function matchStudentVoice(
  spokenTranscript: string,
  enrolledStudents: EnrolledStudentCandidate[],
  threshold = 0.70
): VoiceMatchResult {
  const cleaned = normalizeSpeechTranscript(spokenTranscript);
  if (!cleaned || enrolledStudents.length === 0) {
    return {
      exactMatches: [],
      fuzzyMatches: [],
      allMatches: [],
      bestMatch: null,
      status: 'NO_MATCH',
      cleanedQuery: cleaned,
    };
  }

  // Score all students
  const scoredCandidates: Array<{
    student: EnrolledStudentCandidate;
    score: number;
    isExactFull: boolean;
    isExactToken: boolean;
    isPhonetic: boolean;
  }> = [];

  for (const s of enrolledStudents) {
    const res = scoreCandidateMatch(cleaned, s);
    if (res.score >= threshold) {
      scoredCandidates.push({
        student: s,
        score: res.score,
        isExactFull: res.isExactFull,
        isExactToken: res.isExactToken,
        isPhonetic: res.isPhonetic,
      });
    }
  }

  // Sort candidates by score descending. For equal scores, prioritize alphabetical
  scoredCandidates.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.001) {
      return b.score - a.score;
    }
    const nameA = `${a.student.firstName} ${a.student.lastName}`.toLowerCase();
    const nameB = `${b.student.firstName} ${b.student.lastName}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  if (scoredCandidates.length === 0) {
    return {
      exactMatches: [],
      fuzzyMatches: [],
      allMatches: [],
      bestMatch: null,
      status: 'NO_MATCH',
      cleanedQuery: cleaned,
    };
  }

  const allMatches = scoredCandidates.map((c) => c.student);
  const exactCandidates = scoredCandidates
    .filter((c) => c.isExactFull || c.isExactToken || c.score >= 0.90)
    .map((c) => c.student);
  const fuzzyCandidates = scoredCandidates
    .filter((c) => !c.isExactFull && !c.isExactToken && c.score < 0.90)
    .map((c) => ({ student: c.student, score: c.score }));

  // Case 1: Exactly one qualifying match
  if (scoredCandidates.length === 1) {
    const top = scoredCandidates[0];
    const isExact = top.isExactFull || top.isExactToken || top.score >= 0.90;
    return {
      exactMatches: isExact ? [top.student] : [],
      fuzzyMatches: isExact ? [] : [{ student: top.student, score: top.score }],
      allMatches,
      bestMatch: top.student,
      status: isExact ? 'EXACT_SINGLE' : 'FUZZY_SINGLE',
      cleanedQuery: cleaned,
    };
  }

  // If there is exactly ONE clear top match with isExactFull (1.0 direct full name/admission match):
  const exactFullMatches = scoredCandidates.filter((c) => c.isExactFull);
  if (exactFullMatches.length === 1 && (scoredCandidates[1]?.score ?? 0) < 1.0) {
    const top = exactFullMatches[0];
    return {
      exactMatches: [top.student],
      fuzzyMatches: scoredCandidates.filter((c) => c !== top).map((c) => ({ student: c.student, score: c.score })),
      allMatches,
      bestMatch: top.student,
      status: 'EXACT_SINGLE',
      cleanedQuery: cleaned,
    };
  }

  // Case 2: Multiple qualifying matches
  // If multiple candidates match at equal or ambiguous tier, staff must select!
  const isAllExact = exactCandidates.length > 0;

  return {
    exactMatches: allMatches,
    fuzzyMatches: fuzzyCandidates,
    allMatches,
    bestMatch: null, // Multiple candidates -> staff must select!
    status: isAllExact ? 'EXACT_MULTIPLE' : 'FUZZY_MULTIPLE',
    cleanedQuery: cleaned,
  };
}
