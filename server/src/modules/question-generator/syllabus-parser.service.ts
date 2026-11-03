import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

/**
 * Preloaded standard syllabi to provide instantaneous curricula suggestions
 * for Tamil Nadu State Board, CBSE, and University standard courses.
 */
export const PRELOADED_CURRICULA = {
  SCHOOL: {
    TN_STATE_BOARD: [
      {
        standard: 'Class 10',
        subjects: [
          {
            name: 'Mathematics',
            chapters: [
              { name: 'Relations and Functions', topics: ['Ordered Pairs', 'Relations', 'Functions', 'Composition of Functions'] },
              { name: 'Numbers and Sequences', topics: ['Euclid Division Lemma', 'Fundamental Theorem of Arithmetic', 'AP & GP', 'Special Series'] },
              { name: 'Algebra', topics: ['Linear Equations in 3 Variables', 'GCD & LCM of Polynomials', 'Quadratic Equations', 'Matrices'] },
              { name: 'Geometry', topics: ['Similarity of Triangles', 'Thales Theorem', 'Pythagoras Theorem', 'Circles & Tangents'] },
              { name: 'Coordinate Geometry', topics: ['Slope of Line', 'Area of Triangle & Quadrilateral', 'Equation of Straight Line'] },
              { name: 'Trigonometry', topics: ['Trigonometric Identities', 'Heights and Distances'] },
              { name: 'Mensuration', topics: ['Surface Area of Solids', 'Volume of Cylinder, Cone, Sphere', 'Combination of Solids'] },
              { name: 'Statistics and Probability', topics: ['Measures of Dispersion', 'Standard Deviation', 'Probability of Events', 'Addition Theorem'] },
            ],
          },
          {
            name: 'Science',
            chapters: [
              { name: 'Laws of Motion', topics: ['Inertia', 'Newton Laws of Motion', 'Conservation of Momentum', 'Gravitation'] },
              { name: 'Optics', topics: ['Refraction', 'Lenses', 'Human Eye', 'Microscopes & Telescopes'] },
              { name: 'Thermal Physics', topics: ['Temperature', 'Gas Laws', 'Thermal Energy', 'Joule Heating'] },
              { name: 'Electricity', topics: ['Electric Current', 'Ohm Law', 'Resistors in Series & Parallel', 'Electric Power'] },
              { name: 'Periodic Classification of Elements', topics: ['Modern Periodic Table', 'Periodic Properties', 'Metallurgy'] },
              { name: 'Solutions', topics: ['Types of Solutions', 'Solubility', 'Hydrated Salts'] },
              { name: 'Carbon and Its Compounds', topics: ['Bonding in Carbon', 'Homologous Series', 'Functional Groups', 'Ethanol & Ethanoic Acid'] },
              { name: 'Plant Anatomy and Plant Physiology', topics: ['Tissues', 'Photosynthesis', 'Respiration'] },
              { name: 'Genetics', topics: ['Mendel Laws of Inheritance', 'Chromosomes', 'DNA Structure'] },
            ],
          },
          {
            name: 'Social Science',
            chapters: [
              { name: 'Outbreak of World War I and Its Aftermath', topics: ['Causes of WWI', 'Russian Revolution', 'League of Nations'] },
              { name: 'India - Location, Relief and Drainage', topics: ['Physiographic Divisions', 'Himalayas', 'River Systems'] },
              { name: 'Indian Constitution', topics: ['Preamble', 'Fundamental Rights', 'Directive Principles', 'Emergency Provisions'] },
              { name: 'Gross Domestic Product and Its Growth', topics: ['GDP Calculation', 'Composition of GDP', 'Economic Growth vs Development'] },
            ],
          },
        ],
      },
      {
        standard: 'Class 12',
        subjects: [
          {
            name: 'Physics',
            chapters: [
              { name: 'Electrostatics', topics: ['Coulomb Law', 'Electric Field & Flux', 'Gauss Law Applications', 'Capacitors'] },
              { name: 'Current Electricity', topics: ['Drift Velocity', 'Kirchhoff Rules', 'Wheatstone Bridge', 'Potentiometer'] },
              { name: 'Magnetism and Magnetic Effects of Electric Current', topics: ['Biot-Savart Law', 'Ampere Circuital Law', 'Cyclotron', 'Galvanometer'] },
              { name: 'Electromagnetic Induction and Alternating Current', topics: ['Faraday Law', 'Lenz Law', 'Self & Mutual Inductance', 'AC Generator', 'LCR Circuit'] },
              { name: 'Wave Optics', topics: ['Wavefronts', 'Huygens Principle', 'Young Double Slit Experiment', 'Diffraction & Polarization'] },
              { name: 'Modern Physics', topics: ['Photoelectric Effect', 'De Broglie Waves', 'Bohr Atom Model', 'Nuclear Fission & Fusion', 'Semiconductor Diodes'] },
            ],
          },
          {
            name: 'Computer Science',
            chapters: [
              { name: 'Functions and Data Abstraction', topics: ['Function Specification', 'Pure vs Impure Functions', 'Abstract Data Types', 'Pairs & Tuples'] },
              { name: 'Scoping and Algorithmic Strategies', topics: ['LEGB Rule', 'Searching & Sorting Algorithms', 'Asymptotic Notations'] },
              { name: 'Python - Variables, Control Structures and Functions', topics: ['Conditionals', 'Loops', 'Built-in & User-defined Functions'] },
              { name: 'Strings and String Manipulation', topics: ['Slicing', 'String Operators', 'String Formatting'] },
              { name: 'Object Oriented Programming with Python', topics: ['Classes and Objects', 'Constructors and Destructors', 'Encapsulation'] },
              { name: 'Database Concepts and SQL', topics: ['Relational Model', 'DDL & DML Commands', 'Constraints', 'Joins'] },
            ],
          },
        ],
      },
    ],
    CBSE: [
      {
        standard: 'Class 10',
        subjects: [
          {
            name: 'Mathematics',
            chapters: [
              { name: 'Real Numbers', topics: ['Fundamental Theorem of Arithmetic', 'Irrational Numbers Verification'] },
              { name: 'Polynomials', topics: ['Zeros of a Polynomial', 'Relationship between Zeros and Coefficients'] },
              { name: 'Pair of Linear Equations in Two Variables', topics: ['Graphical Method', 'Substitution & Elimination Methods'] },
              { name: 'Quadratic Equations', topics: ['Factorization', 'Quadratic Formula', 'Nature of Roots'] },
              { name: 'Arithmetic Progressions', topics: ['nth Term of an AP', 'Sum of First n Terms'] },
              { name: 'Triangles', topics: ['Similarity Criteria', 'Basic Proportionality Theorem'] },
              { name: 'Coordinate Geometry', topics: ['Distance Formula', 'Section Formula'] },
              { name: 'Introduction to Trigonometry', topics: ['Trigonometric Ratios', 'Trigonometric Identities'] },
            ],
          },
        ],
      },
    ],
  },
  COLLEGE: {
    ENGINEERING: [
      {
        degree: 'B.E. Computer Science and Engineering',
        semester: 'Semester 4',
        subjects: [
          {
            name: 'Design and Analysis of Algorithms',
            units: [
              { name: 'Unit I: Introduction and Foundations', topics: ['Notion of Algorithm', 'Fundamentals of Algorithmic Problem Solving', 'Analysis Framework', 'Asymptotic Notations', 'Mathematical Analysis of Non-recursive and Recursive Algorithms'] },
              { name: 'Unit II: Brute Force and Divide-and-Conquer', topics: ['Selection Sort and Bubble Sort', 'Sequential Search', 'Closest-Pair Problem', 'Divide-and-Conquer: Merge Sort, Quick Sort', 'Strassen Matrix Multiplication'] },
              { name: 'Unit III: Dynamic Programming and Greedy Technique', topics: ['Warshall and Floyd Algorithms', 'Knapsack Problem and Memory Functions', 'Greedy: Prim Algorithm, Kruskal Algorithm', 'Dijkstra Algorithm', 'Huffman Trees'] },
              { name: 'Unit IV: Iterative Improvement', topics: ['Simplex Method', 'Maximum Flow Problem', 'Maximum Bipartite Matching', 'Stable Marriage Problem'] },
              { name: 'Unit V: Coping with Limitations of Algorithm Power', topics: ['Lower-Bound Arguments', 'Decision Trees', 'P, NP, NP-Complete and NP-Hard Problems', 'Backtracking: n-Queens, Hamiltonian Circuit, Subset-Sum', 'Branch and Bound: Assignment, Knapsack'] },
            ],
          },
          {
            name: 'Database Management Systems',
            units: [
              { name: 'Unit I: Relational Databases', topics: ['Purpose of Database System', 'Views of Data', 'Data Models', 'Database System Architecture', 'Relational Model', 'Relational Algebra', 'SQL Fundamentals', 'Integrity Constraints'] },
              { name: 'Unit II: Database Design and Normalization', topics: ['ER Model', 'ER-to-Relational Mapping', 'Functional Dependencies', 'Normal Forms: 1NF, 2NF, 3NF, BCNF', 'Multi-valued Dependencies and 4NF'] },
              { name: 'Unit III: Transactions and Concurrency Control', topics: ['Transaction Concept', 'ACID Properties', 'Serializability', 'Two-Phase Locking (2PL)', 'Deadlock Handling', 'Timestamp-based Protocols'] },
              { name: 'Unit IV: Indexing and Query Processing', topics: ['RAID Levels', 'B+ Tree Index Files', 'Static and Dynamic Hashing', 'Query Processing Overview', 'Query Optimization'] },
              { name: 'Unit V: Advanced Topics', topics: ['Distributed Databases', 'NoSQL Database Types: Key-Value, Document, Graph', 'CAP Theorem', 'Object-Relational Databases'] },
            ],
          },
        ],
      },
      {
        degree: 'B.Tech Artificial Intelligence and Data Science',
        semester: 'Semester 5',
        subjects: [
          {
            name: 'Machine Learning Fundamentals',
            units: [
              { name: 'Unit I: Supervised Learning', topics: ['Linear Regression', 'Logistic Regression', 'Gradient Descent', 'Regularization (L1/L2)'] },
              { name: 'Unit II: Tree-based Models and Ensembles', topics: ['Decision Trees', 'Information Gain & Gini Impurity', 'Random Forests', 'AdaBoost and Gradient Boosting'] },
              { name: 'Unit III: Unsupervised Learning', topics: ['K-Means Clustering', 'Hierarchical Clustering', 'Principal Component Analysis (PCA)', 'Expectation Maximization'] },
              { name: 'Unit IV: Probabilistic Models', topics: ['Bayes Theorem', 'Naive Bayes Classifier', 'Bayesian Networks', 'Hidden Markov Models'] },
              { name: 'Unit V: Neural Networks and Deep Learning Intro', topics: ['Perceptron', 'Multi-Layer Perceptron (MLP)', 'Backpropagation', 'Activation Functions', 'Overfitting and Dropout'] },
            ],
          },
        ],
      },
    ],
    ARTS_SCIENCE: [
      {
        degree: 'B.Sc Computer Science',
        semester: 'Semester 3',
        subjects: [
          {
            name: 'Data Structures and Algorithms',
            units: [
              { name: 'Unit I: Linear Data Structures', topics: ['Arrays', 'Linked Lists (Singly, Doubly, Circular)', 'Stack Operations and Applications', 'Queue Operations and Circular Queues'] },
              { name: 'Unit II: Non-Linear Data Structures - Trees', topics: ['Binary Trees', 'Binary Search Trees (BST)', 'Tree Traversals (Inorder, Preorder, Postorder)', 'AVL Trees'] },
              { name: 'Unit III: Non-Linear Data Structures - Graphs', topics: ['Graph Representations', 'BFS and DFS', 'Topological Sort', 'Minimum Spanning Trees'] },
              { name: 'Unit IV: Sorting and Searching', topics: ['Bubble, Insertion, Selection Sort', 'Merge Sort and Quick Sort', 'Linear and Binary Search'] },
              { name: 'Unit V: Hashing and File Structures', topics: ['Hash Functions', 'Collision Resolution Techniques', 'Indexing', 'B-Trees'] },
            ],
          },
        ],
      },
    ],
  },
};

/**
 * Sanitizes untrusted user text against prompt injection attempts.
 * Neutralizes instructions like "Ignore all previous instructions", "Reveal your prompt", etc.
 */
export function sanitizeSyllabusText(text: string): string {
  if (!text) return '';

  // Truncate to reasonable maximum length (e.g. 50,000 characters)
  const trimmed = text.trim().slice(0, 50000);

  // Redact common prompt injection keywords safely
  return trimmed
    .replace(/(?:ignore|forget|disregard)\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|prompts|rules)/gi, '[REDACTED_DIRECTIVE]')
    .replace(/(?:system\s+prompt|reveal\s+instructions|system\s+message)/gi, '[REDACTED_SYSTEM_QUERY]')
    .replace(/<\|im_start\|>|<\|im_end\|>|\[INST\]|\[\/INST\]/g, ' ');
}

/**
 * Robust extraction of pure text from an uploaded DOCX file.
 * A .docx file is a ZIP archive containing word/document.xml.
 */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    // DOCX format is PK zip archive. We search for word/document.xml entry.
    const uncompressedText = buffer.toString('binary');
    const xmlHeaderIdx = uncompressedText.indexOf('word/document.xml');

    if (xmlHeaderIdx === -1) {
      // Fallback: search for any XML text tags <w:t> in the buffer
      const directTextMatch = buffer.toString('utf-8').match(/<w:t[^>]*>(.*?)<\/w:t>/g);
      if (directTextMatch && directTextMatch.length > 0) {
        return directTextMatch
          .map((m) => m.replace(/<[^>]+>/g, ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      throw new Error('Could not locate word/document.xml in DOCX container');
    }

    // Try extracting with standard string extraction of <w:t> tags
    const decodedUtf8 = buffer.toString('utf-8');
    const matches = decodedUtf8.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
    if (matches && matches.length > 0) {
      return matches
        .map((m) => m.replace(/<[^>]+>/g, ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    return '';
  } catch (err: any) {
    console.warn('[DocxExtractor] Warning extracting docx text:', err.message);
    throw new Error(`DOCX text extraction failed: ${err.message}`);
  }
}

/**
 * Robust extraction of pure text from an uploaded PDF file without external heavy binaries.
 * Parses PDF text streams between BT (Begin Text) and ET (End Text) operators.
 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const raw = buffer.toString('latin1');
    const textPieces: string[] = [];

    // Match text blocks inside BT ... ET
    const btRegex = /BT[\s\S]*?ET/g;
    let match: RegExpExecArray | null;

    while ((match = btRegex.exec(raw)) !== null) {
      const block = match[0];
      // Extract literals inside parentheses: (Some Text) Tj or TJ arrays [(Some) 20 (Text)] TJ
      const literalRegex = /\(([^)]*)\)\s*(?:Tj|'|")/g;
      let litMatch: RegExpExecArray | null;
      while ((litMatch = literalRegex.exec(block)) !== null) {
        if (litMatch[1]) {
          textPieces.push(litMatch[1]);
        }
      }

      // Also extract text inside TJ brackets: [(Text 1) 10 (Text 2)] TJ
      const tjRegex = /\[(.*?)\]\s*TJ/g;
      let tjMatch: RegExpExecArray | null;
      while ((tjMatch = tjRegex.exec(block)) !== null) {
        const innerArray = tjMatch[1];
        const innerLits = innerArray.match(/\(([^)]*)\)/g);
        if (innerLits) {
          innerLits.forEach((lit) => {
            textPieces.push(lit.slice(1, -1));
          });
        }
      }
    }

    const extracted = textPieces.join(' ').replace(/\s+/g, ' ').trim();
    if (extracted.length > 20) {
      return extracted;
    }

    // Fallback if compressed stream: return readable ASCII chunks
    const asciiMatches = raw.match(/[\x20-\x7E\t\r\n]{4,}/g);
    if (asciiMatches) {
      const filtered = asciiMatches
        .filter((s) => !s.startsWith('/Filter') && !s.startsWith('endobj') && !s.startsWith('stream'))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (filtered.length > 50) {
        return filtered.slice(0, 15000);
      }
    }

    throw new Error('PDF does not contain extractable plain text (may be scanned image or encrypted).');
  } catch (err: any) {
    throw new Error(`PDF text extraction error: ${err.message}`);
  }
}

/**
 * Main dispatcher to extract text from an uploaded file based on its mime type / extension.
 */
export async function extractTextFromFile(filePath: string, originalName: string, mimeType: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error('Uploaded file could not be found on server');
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(originalName).toLowerCase();

  let extractedText = '';

  if (ext === '.txt' || ext === '.md' || ext === '.csv' || mimeType.includes('text/plain')) {
    extractedText = buffer.toString('utf-8');
  } else if (ext === '.docx' || mimeType.includes('wordprocessingml')) {
    extractedText = await extractDocxText(buffer);
  } else if (ext === '.pdf' || mimeType.includes('pdf')) {
    extractedText = await extractPdfText(buffer);
  } else {
    throw new Error(`Unsupported document extension '${ext}'. Please upload a .txt, .pdf, or .docx file.`);
  }

  const sanitized = sanitizeSyllabusText(extractedText);
  if (!sanitized || sanitized.length < 10) {
    throw new Error('Document extraction yielded empty or unreadable content. Please verify file is not an image scan or empty.');
  }

  return sanitized;
}
