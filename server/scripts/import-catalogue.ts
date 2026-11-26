import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient, CourseStatus } from '@prisma/client';
import { assertSafeTestDatabase } from '../src/utils/test-db-guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ResolvedBrochure {
  fileUrl: string;
  fileSize: number;
}

/**
 * Validates whether a course brochure exists in the deployment environment and returns its exact size.
 * Returns null if the file does not exist, preventing creation of broken attachment records.
 */
export function resolveBrochureAttachment(brochureUrl?: string): ResolvedBrochure | null {
  if (!brochureUrl || !brochureUrl.trim()) return null;

  const candidateRoots = [
    path.resolve(__dirname, '../../apps/web/public'),
    path.resolve(process.cwd(), 'apps/web/public'),
    path.resolve(process.cwd(), '../apps/web/public'),
    path.resolve(__dirname, '../uploads'),
    path.resolve(process.cwd(), 'server/uploads'),
    path.resolve(process.cwd(), 'uploads'),
  ];

  const cleanPath = brochureUrl.replace(/^\/+/, '');

  for (const root of candidateRoots) {
    const fullPath = path.resolve(root, cleanPath);
    if (fs.existsSync(fullPath)) {
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isFile() && stats.size > 0) {
          return {
            fileUrl: brochureUrl,
            fileSize: stats.size,
          };
        }
      } catch {
        // continue search
      }
    }
  }

  return null;
}

export function resolveImageAsset(assetUrl?: string): boolean {
  if (!assetUrl || !assetUrl.trim()) return false;

  const candidateRoots = [
    path.resolve(__dirname, '../../apps/web/public'),
    path.resolve(process.cwd(), 'apps/web/public'),
    path.resolve(process.cwd(), '../apps/web/public'),
    path.resolve(__dirname, '../uploads'),
    path.resolve(process.cwd(), 'server/uploads'),
    path.resolve(process.cwd(), 'uploads'),
  ];

  const cleanPath = assetUrl.replace(/^\/+/, '');

  for (const root of candidateRoots) {
    const fullPath = path.resolve(root, cleanPath);
    if (fs.existsSync(fullPath)) {
      return true;
    }
  }

  return false;
}

interface CliOptions {
  dryRun: boolean;
  schema: string;
  allowProd: boolean;
  permitFranchiseId?: string;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let dryRun = false;
  let schema = 'public';
  let allowProd = false;
  let permitFranchiseId: string | undefined;

  for (const arg of args) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--allow-prod' || arg === '--execute') allowProd = true;
    else if (arg.startsWith('--schema=')) schema = arg.split('=')[1] || 'public';
    else if (arg.startsWith('--permit-franchise-id=')) permitFranchiseId = arg.split('=')[1] || undefined;
  }

  // If no flags provided or only schema provided without --execute / --allow-prod, default to dry-run
  if (!dryRun && !allowProd) {
    console.log('ℹ️  No execution flag provided. Defaulting to safe DRY-RUN mode. Use --execute to persist changes.');
    dryRun = true;
  }

  return { dryRun, schema, allowProd, permitFranchiseId };
}

// ============================================================================
// AUTHENTIC DIGITAL GURU SOURCE CATEGORIES
// ============================================================================
export const SOURCE_CATEGORIES = [
  {
    name: 'Marketing & AI',
    slug: 'marketing-ai',
    description: 'AI-powered digital marketing, SEO, performance ads, and brand growth programs.',
    icon: 'TrendingUp',
    sortOrder: 1,
  },
  {
    name: 'Full Stack Development',
    slug: 'full-stack-development',
    description: 'Modern web development with React JS, Node.js, Express, MongoDB, and AI coding workflows.',
    icon: 'Code2',
    sortOrder: 2,
  },
];

// ============================================================================
// AUTHENTIC DIGITAL GURU SOURCE COURSES (EXTRACTED FROM digitalghuru_updated)
// ============================================================================
export const SOURCE_COURSES = [
  // 1. AI-POWERED DIGITAL MARKETING COURSE
  {
    slug: 'ai-powered-digital-marketing',
    categorySlug: 'marketing-ai',
    title: 'AI-Powered Digital Marketing Course',
    subTitle: 'The New Digital Marketing + AI Course',
    description:
      'Digital marketing combined with AI is rapidly transforming how businesses grow and compete. Learn modern marketing with AI tools. Build core skills. Create live ad campaigns. Grow your career with hands-on practice.',
    format: 'Classroom + Online',
    duration: '3 to 6 Months',
    level: 'Beginner to Advanced',
    price: 0,
    status: CourseStatus.PUBLISHED,
    thumbnailUrl: '/uploads/courses/1789123754349-ai-powered-digital-marketing-course-card.webp',
    bannerUrl: '/uploads/courses/1789123324736-ai-powered-digital-marketing-banner.jpg.webp',
    brochureUrl: '/Courses/AI Powered Digital Marketing Course.pdf',
    learningOutcomes: [
      'Learn the digital ecosystem and buyer journey',
      'Create AI text, images, and videos with ChatGPT and Midjourney',
      'Plan high-growth social media campaigns across top platforms',
      'Master the Instagram algorithm, trending reels, and influencer ads',
      'Build a strong personal brand on LinkedIn to get B2B leads',
      'Design fast landing pages and high-converting sales funnels',
      'Automate email and WhatsApp workflows using smart CRM tools',
      'Run profitable Meta and Google ad campaigns with real ROI',
      'Build websites in WordPress and rank them with SEO',
      'Design clean graphics and ads using Canva and AI tools',
    ],
    targetAudience: ['Entrepreneurs', 'Professionals', 'Students', 'Freelancers'],
    toolsCovered: ['ChatGPT', 'Midjourney', 'Canva', 'WordPress', 'Google Ads', 'Meta Ads', 'Zapier'],
    overviewJson: {
      batchInfo: 'New Batches Starting Soon | 12 Modules',
      location: 'Anna Nagar | Nungambakkam | Korattur | Online & Offline Campuses',
      originalPrice: '—',
      discountedPrice: 'Contact Us',
      showCareerFeatures: true,
      usps: [
        'Personal Mentorship',
        'Practical Learning Approach',
        'Updated Curriculum with AI',
        'Hands-On Experience',
        'Portfolio Building',
        'Freelancing & Earning Support',
      ],
      overviewDescription: [
        'Digital marketing and AI are changing how brands grow. This course gives you a clear roadmap. Build strong marketing basics. Use AI tools to work faster. Launch high-performing campaigns that bring real sales.',
        'At Digital Ghuru, we focus on real skills. You will learn how to create content, reach buyers, and convert sales. AI tools like ChatGPT and Midjourney help you work with speed and confidence.',
        'Our students learn by doing. You will work on live client projects. You will build a verified portfolio. Land in-demand roles as an SEO specialist, ad manager, content creator, or freelancer.',
      ],
      overviewLearnings: [
        'Learn the digital ecosystem and buyer journey.',
        'Create AI text, images, and videos with ChatGPT and Midjourney.',
        'Plan high-growth social media campaigns across top platforms.',
        'Master the Instagram algorithm, trending reels, and influencer ads.',
        'Build a strong personal brand on LinkedIn to get B2B leads.',
        'Design fast landing pages and high-converting sales funnels.',
        'Automate email and WhatsApp workflows using smart CRM tools.',
        'Run profitable Meta and Google ad campaigns with real ROI.',
        'Build websites in WordPress and rank them with SEO.',
        'Design clean graphics and ads using Canva and AI tools.',
      ],
      whoIsThisForData: [
        {
          role: 'Entrepreneurs',
          title: 'Entrepreneurs',
          iconName: 'TrendingUp',
          desc: 'Grow your business online. Generate quality leads and scale sales with AI marketing tools.',
          points: [
            'Build a strong online presence for your business',
            'Generate quality leads and increase sales',
            'Stay ahead using AI-powered marketing strategies',
          ],
        },
        {
          role: 'Professionals',
          title: 'Professionals',
          iconName: 'Briefcase',
          desc: 'Upgrade your skills. Transition into high-growth digital roles with higher pay.',
          points: [
            'Learn in-demand digital marketing & AI skills',
            'Transition into high-growth digital roles',
            'Enhance your career opportunities and salary potential',
          ],
        },
        {
          role: 'Students',
          title: 'Students',
          iconName: 'GraduationCap',
          desc: 'Kickstart your career. Work on live projects, build a portfolio, and clear job interviews.',
          points: [
            'Gain practical, job-ready skills',
            'Work on real-time projects and build your portfolio',
            'Prepare for interviews and career opportunities',
          ],
        },
        {
          role: 'Freelancers',
          title: 'Freelancers',
          iconName: 'Laptop',
          desc: 'Scale your freelance income. Offer in-demand marketing services to global clients.',
          points: [
            'Expand your service offerings with digital marketing',
            'Attract high-paying clients globally',
            'Build a consistent and scalable income stream',
          ],
        },
      ],
      categorizedToolsData: [
        {
          category: 'AI Content & Automation',
          description: 'Generative AI and workflow tools used daily by growth teams.',
          tools: [
            { name: 'ChatGPT', iconUrl: '/tools/openai.svg' },
            { name: 'Midjourney', iconUrl: '/tools/midjourney.svg' },
            { name: 'Zapier', iconUrl: '/tools/zapier.svg' },
          ],
        },
        {
          category: 'Ads, SEO & Design',
          description: 'Performance advertising, analytics, web CMS, and creative tools.',
          tools: [
            { name: 'Canva', iconUrl: '/tools/canva.svg' },
            { name: 'WordPress', iconUrl: '/tools/wordpress.svg' },
            { name: 'Google Ads', iconUrl: '/tools/googleads.svg' },
            { name: 'Meta Ads', iconUrl: '/tools/meta.svg' },
          ],
        },
      ],
    },
    designedToHelpJson: {
      title: 'This course is designed to help you',
      description: 'At Digital Ghuru, we combine digital marketing with artificial intelligence. This gives you practical skills for real career growth.',
      benefits: [
        { iconName: 'Blocks', title: 'Build strong marketing foundations', description: 'Master marketing fundamentals. Understand the customer journey.' },
        { iconName: 'Sparkles', title: 'Leverage AI for faster execution', description: 'Use modern AI tools to automate work and create content fast.' },
        { iconName: 'Rocket', title: 'Create high-performing campaigns', description: 'Design and launch live campaigns that bring real business sales.' },
        { iconName: 'Globe2', title: 'Stay ahead in the digital ecosystem', description: 'Future-proof your career. Stay updated with the latest AI tools.' },
      ],
    },
    numberedFeaturesJson: {
      title: 'Rise of AI in Marketing',
      description: 'AI helps brands work faster and smarter. Tools like ChatGPT, Canva, and Google Ads help you create campaigns with speed.',
      features: [
        { num: '01', iconName: 'BrainCircuit', title: 'Automation to Intelligence', description: 'AI helps you make smart decisions with data.' },
        { num: '02', iconName: 'FileImage', title: 'Content Creation at Scale', description: 'Generate text, images, and video ads in seconds.' },
        { num: '03', iconName: 'BarChart3', title: 'Data-Driven Marketing', description: 'Track buyer habits with pinpoint accuracy.' },
        { num: '04', iconName: 'UserCog', title: 'Personalization', description: 'Deliver custom offers to each buyer.' },
      ],
    },
    whyDigitalGhuruJson: {
      title: 'Why Digital Ghuru',
      reasons: [
        { num: '01', iconName: 'Search', title: 'AI Integration', description: 'Hands-on training with top AI tools for content and ads.' },
        { num: '02', iconName: 'PenTool', title: 'Practical Learning Approach', description: 'Learn by running real-time projects and live ads.' },
        { num: '03', iconName: 'RefreshCcw', title: 'Updated Curriculum', description: 'Aligned with current hiring needs and AI trends.' },
        { num: '04', iconName: 'Laptop2', title: 'Hands-On Experience', description: 'Launch real campaigns and build sales funnels.' },
        { num: '05', iconName: 'Users', title: 'Personal Mentorship', description: 'Get 1-on-1 guidance from senior marketing mentors.' },
        { num: '06', iconName: 'DollarSign', title: 'Freelancing & Earning Support', description: 'Learn how to win global clients and earn from skills.' },
        { num: '07', iconName: 'FolderOpen', title: 'Portfolio Building', description: 'Build verified proof of work to impress hiring teams.' },
      ],
    },
    topHighlightsJson: [
      { iconName: 'Users', title: 'Personal Mentorship', description: 'Get 1-on-1 guidance and campaign reviews from mentors.' },
      { iconName: 'Lightbulb', title: 'Practical Learning Approach', description: 'Hands-on practice with real client projects and live case studies.' },
      { iconName: 'Bot', title: 'Updated Curriculum with AI', description: 'Learn AI prompt engineering, chatbot funnels, and ad tuning.' },
      { iconName: 'FolderKanban', title: 'Portfolio Building', description: 'Build a job-ready portfolio that showcases real campaign results.' },
      { iconName: 'BriefcaseBusiness', title: 'Freelancing & Earning Support', description: 'Learn how to find high-paying clients and set your pricing.' },
      { iconName: 'Award', title: 'Industry Certifications', description: 'Earn course certificates plus official Google and Meta credentials.' },
    ],
    faqsJson: [
      { question: 'Do I need prior experience?', answer: 'No, this course starts from the basics.' },
      { question: 'Is this course practical?', answer: 'Yes, completely hands-on with real projects.' },
      { question: 'Will I get job support?', answer: 'Yes, we provide placement assistance.' },
    ],
    curriculum: [
      { title: 'Module 1: Audience Research', topics: ['Understand the digital ecosystem and customer journey.', 'Learn core marketing concepts and strategies.', 'Identify target audience and business goals.', 'Build a strong foundation in digital marketing.'] },
      { title: 'Module 2: AI Content Mastery', topics: ['Learn prompt engineering for content creation.', 'Generate high-quality text, images, and videos using AI.', 'Automate content creation for faster execution.', 'Use tools like ChatGPT and Midjourney.'] },
      { title: 'Module 3: Social Media Marketing', topics: ['Plan and create engaging content strategies.', 'Increase followers and audience engagement.', 'Understand platform-specific growth techniques.', 'Manage social media pages effectively.'] },
      { title: 'Module 4: Instagram Marketing', topics: ['Master Instagram algorithm and trends.', 'Create high-performing reels and posts.', 'Implement influencer marketing strategies.', 'Optimize profile for better reach and engagement.'] },
      { title: 'Module 5: LinkedIn Marketing', topics: ['Build a strong personal brand.', 'Generate B2B leads and connections.', 'Create professional content strategies.', 'Optimize LinkedIn profile for growth.'] },
      { title: 'Module 6: Landing Page & Funnel Building', topics: ['Create high-converting landing pages.', 'Build sales funnels for lead generation.', 'Understand user journey and conversions.', 'Optimize pages for better performance.'] },
      { title: 'Module 7: Marketing Automation', topics: ['Automate email and WhatsApp marketing.', 'Set up CRM tools and workflows.', 'Save time with automation systems.', 'Improve customer engagement and follow-ups.'] },
      { title: 'Module 8: Facebook & Instagram Ads', topics: ['Create ad campaigns for leads and sales.', 'Target the right audience effectively.', 'Analyze performance and optimize ads.', 'Improve ROI with data-driven strategies.'] },
      { title: 'Module 9: Website Development', topics: ['Build websites using WordPress.', 'Customize pages and design layouts.', 'Create landing pages for campaigns.', 'Optimize website performance.'] },
      { title: 'Module 10: Search Engine Optimization (SEO)', topics: ['Optimize website for search engines.', 'Learn on-page and off-page SEO.', 'Improve rankings and organic traffic.', 'Perform basic technical SEO.'] },
      { title: 'Module 11: Search Engine Marketing (SEM)', topics: ['Run ads using Google Ads.', 'Learn keyword targeting and bidding.', 'Create high-converting PPC campaigns.', 'Track and measure ad performance.'] },
      { title: 'Module 12: Digital Design Mastery', topics: ['Design creatives using Canva.', 'Create social media posts and ad creatives.', 'Build brand identity and visual content.', 'Understand design principles.'] },
    ],
  },

  // 2. REACT JS FULL STACK DEVELOPMENT COURSE
  {
    slug: 'react-js-full-stack-development',
    categorySlug: 'full-stack-development',
    title: 'React JS Full Stack Development Course',
    subTitle: 'Master Frontend, Backend & Full Stack Web Development',
    description:
      'Learn full stack web development with React and Node.js. Build fast web apps. Work on live projects. Get 100% placement support to start your tech career.',
    format: 'Online & Offline Campuses',
    duration: '4 to 6 Months',
    level: 'Beginner to Industry-Ready',
    price: 0,
    status: CourseStatus.PUBLISHED,
    thumbnailUrl: '/uploads/courses/1789124003189-react-js-full-stack-developer-course-card.webp',
    bannerUrl: '/uploads/courses/1789124027228-react-js-full-stack-developer-banner.jpg.webp',
    brochureUrl: '/Courses/React JS Full Stack Development.pdf',
    learningOutcomes: [
      'Build modern user interfaces with React and Tailwind CSS',
      'Develop scalable backends using Node.js and Express',
      'Design and manage databases using MongoDB',
      'Create full-stack web applications with secure user login',
      'Master team workflows using Git and GitHub',
      'Solve real business problems using modern agile practices',
    ],
    targetAudience: ['Entrepreneurs', 'Professionals', 'Students', 'Freelancers'],
    toolsCovered: ['React', 'Node.js', 'Express', 'MongoDB', 'Redux', 'Tailwind CSS', 'Postman', 'Vercel & Render'],
    overviewJson: {
      batchInfo: 'New Batches Starting Soon | 7 Modules',
      location: 'Online & Offline Campuses',
      originalPrice: '—',
      discountedPrice: 'Contact Us',
      showCareerFeatures: true,
      usps: [
        'Personal Mentorship',
        '80% Practical Learning',
        'Industry Capstone Projects',
        'AI-Powered Coding Workflows',
        'GitHub Portfolio Reviews',
        'Placement Assistance',
      ],
      overviewDescription: [
        'Modern tech firms need fast, scalable web apps. This course helps you become a job-ready full stack developer. Learn both frontend and backend coding with hands-on practice.',
        'You will build real-world software, not just follow theory. Write clean code with Node.js and MongoDB. Create dynamic web apps with React.',
        'Work on live team projects with code reviews from senior developers. Graduate with a strong GitHub portfolio that helps you stand out in tech interviews.',
      ],
      overviewLearnings: [
        'Build modern user interfaces with React and Tailwind CSS.',
        'Develop scalable backends using Node.js and Express.',
        'Design and manage databases using MongoDB.',
        'Create full-stack web applications with secure user login.',
        'Master team workflows using Git and GitHub.',
        'Solve real business problems using modern agile practices.',
      ],
      whoIsThisForData: [
        {
          role: 'Entrepreneurs',
          title: 'Entrepreneurs',
          iconName: 'TrendingUp',
          desc: 'Build your own web platforms and MVPs without hiring outside agencies.',
          points: [
            'Build custom web platforms and tools',
            'Save costs with in-house product development',
            'Iterate quickly on your business ideas',
          ],
        },
        {
          role: 'Professionals',
          title: 'Professionals',
          iconName: 'Briefcase',
          desc: 'Switch into software engineering with in-demand full-stack skills.',
          points: [
            'Master frontend and backend web frameworks',
            'Transition into high-paying software roles',
            'Boost your career growth in tech',
          ],
        },
        {
          role: 'Students',
          title: 'Students',
          iconName: 'GraduationCap',
          desc: 'Start your coding career. Build real web apps and land your first developer job.',
          points: [
            'Learn coding from the ground up',
            'Build a GitHub portfolio with live projects',
            'Ace technical rounds and coding tests',
          ],
        },
        {
          role: 'Freelancers',
          title: 'Freelancers',
          iconName: 'Laptop',
          desc: 'Build custom web applications for international freelance clients.',
          points: [
            'Deliver full-stack web apps end-to-end',
            'Win global projects on freelance platforms',
            'Earn higher hourly rates with tech skills',
          ],
        },
      ],
      categorizedToolsData: [
        {
          category: 'Frontend Development',
          description: 'Design responsive and visually appealing user interfaces.',
          tools: [
            { name: 'HTML5', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-original.svg' },
            { name: 'CSS3', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-original.svg' },
            { name: 'JavaScript', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg' },
            { name: 'React', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg' },
          ],
        },
        {
          category: 'Backend Development',
          description: 'Build powerful server-side applications and RESTful APIs.',
          tools: [
            { name: 'Node.js', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nodejs/nodejs-original.svg' },
            { name: 'Express', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/express/express-original.svg' },
          ],
        },
        {
          category: 'Database Management',
          description: 'Organized storage, schemas, and handling of application data.',
          tools: [
            { name: 'MongoDB', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mongodb/mongodb-original.svg' },
          ],
        },
        {
          category: 'Developer Tools',
          description: 'Tools used to create, test, version control, and deploy apps.',
          tools: [
            { name: 'Git', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg' },
            { name: 'GitHub', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/github/github-original.svg' },
            { name: 'Postman', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postman/postman-original.svg' },
          ],
        },
      ],
    },
    designedToHelpJson: {
      title: 'What Makes This Program Unique?',
      description: 'We focus on strong technical skills with hands-on exposure to real industry workflows.',
      benefits: [
        { iconName: 'Code2', title: 'Learn by building real applications', description: 'Code from day one. Build interactive web applications.' },
        { iconName: 'BriefcaseBusiness', title: 'Work on industry-based assignments', description: 'Solve real business problems using modern MERN stack tools.' },
        { iconName: 'Users', title: 'Practice coding with mentorship guidance', description: 'Get direct code reviews and feedback from senior engineers.' },
        { iconName: 'TerminalSquare', title: 'Get exposure to agile practices', description: 'Learn agile team workflows and ship production-ready code.' },
      ],
    },
    numberedFeaturesJson: {
      title: 'Why React Full Stack?',
      description: 'React is the top frontend tool in modern web development. Paired with Node.js, it lets you build full web apps with speed.',
      features: [
        { num: '01', iconName: 'Globe2', title: 'High Demand', description: 'High hiring demand in global and Indian tech firms.' },
        { num: '02', iconName: 'Blocks', title: 'Independent Building', description: 'Build complete web applications from start to finish.' },
        { num: '03', iconName: 'Rocket', title: 'Faster Development', description: 'Build reusable components for quick development.' },
        { num: '04', iconName: 'LayoutTemplate', title: 'Strong Ecosystem', description: 'Benefit from massive community support and modern libraries.' },
      ],
    },
    whyDigitalGhuruJson: {
      title: 'AI-Powered Development',
      reasons: [
        { num: '01', iconName: 'Cpu', title: 'Code Writing', description: 'Write clean code faster using modern AI developer tools.' },
        { num: '02', iconName: 'Search', title: 'Debugging', description: 'Find and fix bugs quickly using AI testing tools.' },
        { num: '03', iconName: 'RefreshCcw', title: 'Automation', description: 'Automate routine coding tasks to focus on app logic.' },
        { num: '04', iconName: 'TrendingUp', title: 'Productivity', description: 'Boost your day-to-day coding speed and output.' },
      ],
    },
    topHighlightsJson: [
      { iconName: 'Code2', title: 'End-to-End Training', description: 'Complete full stack training from frontend UI to backend databases.' },
      { iconName: 'Laptop2', title: '80% Practical Learning', description: 'Project-based training focused on real code and assignments.' },
      { iconName: 'Bot', title: 'AI-Powered Workflow', description: 'Learn how modern developers use AI tools to code faster.' },
      { iconName: 'BriefcaseBusiness', title: 'Placement Assistance', description: 'Get internship referrals and dedicated interview preparation.' },
      { iconName: 'Users', title: 'Expert Designed', description: 'Curriculum built by engineers working in top tech companies.' },
      { iconName: 'Workflow', title: 'Lifetime Support', description: 'Get ongoing community support and access to updated resources.' },
    ],
    faqsJson: [
      { question: 'Do I need prior experience?', answer: 'No, this course starts from the basics and assumes zero prior coding knowledge.' },
      { question: 'Is this course practical?', answer: 'Yes, 80% of the learning is practical and project-based.' },
      { question: 'Will I get job support?', answer: 'Yes, we provide internship and placement assistance.' },
    ],
    curriculum: [
      { title: 'Module 1: Web Development Fundamentals', topics: ['Structuring content using semantic HTML', 'Styling modern layouts using CSS (Flexbox & Grid)', 'Creating responsive designs for mobile & desktop', 'Introduction to JavaScript for interactivity'] },
      { title: 'Module 2: Advanced JavaScript Programming', topics: ['ES6+ concepts (arrow functions, destructuring, modules)', 'Execution context & closures', 'DOM manipulation for dynamic UI', 'Event-driven programming', 'Asynchronous JavaScript (Promises, Async/Await)'] },
      { title: 'Module 3: React JS – Frontend Mastery', topics: ['Component-based architecture', 'JSX syntax and rendering logic', 'Props & state management', 'React Hooks (useState, useEffect)', 'Routing for multi-page navigation', 'API integration in React apps'] },
      { title: 'Module 4: Backend Development with Node.js', topics: ['Node.js architecture and event loop', 'Express.js for server creation', 'Building RESTful APIs', 'Middleware and request handling', 'Error handling and debugging'] },
      { title: 'Module 5: Database Management (MongoDB)', topics: ['NoSQL vs SQL concepts', 'MongoDB collections and documents', 'CRUD operations', 'Schema design and validation', 'Integration with backend'] },
      { title: 'Module 6: Full Stack Application Development', topics: ['Connecting React with APIs', 'Authentication & authorization systems', 'State management across applications', 'Deployment (hosting live apps)'] },
      { title: 'Module 7: Capstone Project', topics: ['E-commerce application', 'Admin dashboard system', 'Booking or service platform'] },
    ],
  },
];

function withSchemaUrl(rawUrl: string, schema: string): string {
  const url = new URL(rawUrl);
  url.searchParams.set('schema', schema);
  return url.toString();
}

export async function importCatalogue(options?: Partial<CliOptions>) {
  const parsed = parseArgs();
  const dryRun = options?.dryRun !== undefined ? options.dryRun : parsed.dryRun;
  const schema = options?.schema || parsed.schema;
  let permitFranchiseId = options?.permitFranchiseId || parsed.permitFranchiseId;

  let baseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (process.env.TEST_DATABASE_URL) {
    assertSafeTestDatabase();
    baseUrl = process.env.TEST_DATABASE_URL;
  }
  if (!baseUrl) {
    throw new Error('DATABASE_URL or TEST_DATABASE_URL is missing in environment');
  }

  console.log(`\n============================================================`);
  console.log(` DIGITAL GURU AUTHENTIC COURSE CATALOGUE IMPORTER`);
  console.log(`============================================================`);
  console.log(`Execution Mode:     ${dryRun ? 'DRY-RUN (Safe Validation Only, No Writes)' : 'LIVE EXECUTION (Safe Upsert)'}`);
  console.log(`Target Schema:      ${schema}`);
  console.log(`Source Repository:  digitalghuru_updated`);
  console.log(`Authentic Courses:  ${SOURCE_COURSES.length} courses across ${SOURCE_CATEGORIES.length} categories`);

  const totalExpectedModules = SOURCE_COURSES.reduce((acc, c) => acc + c.curriculum.length, 0);
  const totalExpectedChapters = SOURCE_COURSES.reduce((acc, c) => acc + c.curriculum.reduce((sum, m) => sum + m.topics.length, 0), 0);
  console.log(`Total Modules:      ${totalExpectedModules}`);
  console.log(`Total Chapters:     ${totalExpectedChapters}`);
  console.log(`------------------------------------------------------------\n`);

  // Verify assets on disk
  console.log('1. Checking Course Media & Brochure Assets on Disk...');
  for (const c of SOURCE_COURSES) {
    const brochureRes = resolveBrochureAttachment(c.brochureUrl);
    const thumbExists = resolveImageAsset(c.thumbnailUrl);
    const bannerExists = resolveImageAsset(c.bannerUrl);

    console.log(`   [${c.title}]`);
    console.log(`     - Thumbnail: ${c.thumbnailUrl} -> ${thumbExists ? '✓ FOUND' : '⚠️ MISSING'}`);
    console.log(`     - Banner:    ${c.bannerUrl} -> ${bannerExists ? '✓ FOUND' : '⚠️ MISSING'}`);
    console.log(`     - Brochure:  ${c.brochureUrl} -> ${brochureRes ? `✓ FOUND (${(brochureRes.fileSize / 1024 / 1024).toFixed(2)} MB)` : '⚠️ MISSING'}`);
  }
  console.log('');

  const prisma = new PrismaClient({
    datasources: { db: { url: withSchemaUrl(baseUrl, schema) } },
  });

  const summary = {
    categoriesCreated: 0,
    categoriesUpdated: 0,
    categoriesExisting: 0,
    coursesCreated: 0,
    coursesUpdated: 0,
    coursesExisting: 0,
    modulesCreated: 0,
    modulesExisting: 0,
    chaptersCreated: 0,
    chaptersExisting: 0,
    franchiseSelectionsCreated: 0,
  };

  try {
    // Check existing records in DB
    const existingDbCategories = await prisma.courseCategory.count();
    const existingDbCourses = await prisma.globalCourse.count();
    const existingDbModules = await prisma.courseModule.count();
    const existingDbChapters = await prisma.courseChapter.count();
    const existingDbSelections = await prisma.franchiseCourseSelection.count();

    console.log('2. Current Destination Database Status:');
    console.log(`   - Existing Categories in DB: ${existingDbCategories}`);
    console.log(`   - Existing Courses in DB:    ${existingDbCourses}`);
    console.log(`   - Existing Modules in DB:    ${existingDbModules}`);
    console.log(`   - Existing Chapters in DB:   ${existingDbChapters}`);
    console.log(`   - Existing Franchise Selections: ${existingDbSelections}\n`);

    // Auto-detect franchise if not specified
    if (!permitFranchiseId) {
      const defaultFranchise = await prisma.franchise.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'asc' },
      });
      if (defaultFranchise) {
        permitFranchiseId = defaultFranchise.id;
        console.log(`   ✓ Linked Franchise: [${defaultFranchise.code}] ${defaultFranchise.name} (${defaultFranchise.id})\n`);
      }
    }

    const categoryIdBySlug = new Map<string, string>();

    // Step 1: Process Categories
    console.log('3. Processing Course Categories...');
    for (const cat of SOURCE_CATEGORIES) {
      const existing = await prisma.courseCategory.findUnique({ where: { slug: cat.slug } });
      if (existing) {
        categoryIdBySlug.set(cat.slug, existing.id);
        summary.categoriesExisting++;
        console.log(`   ✓ Category exists: ${cat.name} (${cat.slug}) -> ID: ${existing.id}`);
      } else if (dryRun) {
        categoryIdBySlug.set(cat.slug, `dry-run-${cat.slug}`);
        summary.categoriesCreated++;
        console.log(`   + [DRY-RUN] Would create category: ${cat.name} (${cat.slug})`);
      } else {
        const created = await prisma.courseCategory.create({ data: cat });
        categoryIdBySlug.set(cat.slug, created.id);
        summary.categoriesCreated++;
        console.log(`   ✓ Created category: ${created.name} (${created.slug}) -> ID: ${created.id}`);
      }
    }
    console.log('');

    // Step 2: Process Courses
    console.log('4. Processing Authentic Courses...');
    for (const course of SOURCE_COURSES) {
      const existingCourse = await prisma.globalCourse.findUnique({
        where: { slug: course.slug },
        include: {
          activeCurriculumVersion: {
            include: {
              modules: {
                include: { chapters: true },
                orderBy: { position: 'asc' },
              },
            },
          },
        },
      });

      const modCount = course.curriculum.length;
      const chapCount = course.curriculum.reduce((sum, m) => sum + m.topics.length, 0);

      if (dryRun) {
        if (existingCourse) {
          summary.coursesUpdated++;
          console.log(`   ~ [DRY-RUN] Would reconcile course: ${course.title} (slug: ${course.slug})`);
        } else {
          summary.coursesCreated++;
          summary.modulesCreated += modCount;
          summary.chaptersCreated += chapCount;
          console.log(`   + [DRY-RUN] Would create course: ${course.title} (slug: ${course.slug}) | ${modCount} modules | ${chapCount} lessons`);
        }
        continue;
      }

      // LIVE EXECUTION (Transactional Safe Upsert)
      await prisma.$transaction(async (tx) => {
        let courseId: string;

        if (existingCourse) {
          // Safe Update Metadata (preserves all enrollments and student progress)
          const updated = await tx.globalCourse.update({
            where: { id: existingCourse.id },
            data: {
              title: course.title,
              subTitle: course.subTitle,
              description: course.description,
              categoryId: categoryIdBySlug.get(course.categorySlug) || existingCourse.categoryId,
              format: course.format,
              duration: course.duration,
              level: course.level,
              price: course.price,
              status: course.status,
              thumbnailUrl: course.thumbnailUrl,
              bannerUrl: course.bannerUrl,
              brochureUrl: course.brochureUrl,
              learningOutcomes: course.learningOutcomes,
              targetAudience: course.targetAudience,
              toolsCovered: course.toolsCovered,
              overviewJson: course.overviewJson as any,
              designedToHelpJson: course.designedToHelpJson as any,
              numberedFeaturesJson: course.numberedFeaturesJson as any,
              whyDigitalGhuruJson: course.whyDigitalGhuruJson as any,
              topHighlightsJson: course.topHighlightsJson as any,
              faqsJson: course.faqsJson as any,
            },
          });
          courseId = updated.id;
          summary.coursesUpdated++;
          console.log(`   ✓ Reconciled course metadata: ${course.title} (${courseId})`);
        } else {
          // Create new course
          const created = await tx.globalCourse.create({
            data: {
              title: course.title,
              slug: course.slug,
              subTitle: course.subTitle,
              description: course.description,
              categoryId: categoryIdBySlug.get(course.categorySlug) || null,
              format: course.format,
              duration: course.duration,
              level: course.level,
              price: course.price,
              status: course.status,
              thumbnailUrl: course.thumbnailUrl,
              bannerUrl: course.bannerUrl,
              brochureUrl: course.brochureUrl,
              learningOutcomes: course.learningOutcomes,
              targetAudience: course.targetAudience,
              toolsCovered: course.toolsCovered,
              overviewJson: course.overviewJson as any,
              designedToHelpJson: course.designedToHelpJson as any,
              numberedFeaturesJson: course.numberedFeaturesJson as any,
              whyDigitalGhuruJson: course.whyDigitalGhuruJson as any,
              topHighlightsJson: course.topHighlightsJson as any,
              faqsJson: course.faqsJson as any,
            },
          });
          courseId = created.id;
          summary.coursesCreated++;
          console.log(`   ✓ Created course: ${created.title} (${courseId})`);
        }

        // Check Curriculum Version
        let activeVersion = existingCourse?.activeCurriculumVersion;
        if (!activeVersion) {
          // Note: PostgreSQL trigger forbids inserting modules into locked/published versions.
          // Create unlocked first, insert all modules/chapters, then lock & publish.
          activeVersion = await tx.courseCurriculumVersion.create({
            data: {
              courseId,
              version: 1,
              title: 'Version 1.0 (Source Catalogue Import)',
              isPublished: false,
              isLocked: false,
              modules: {
                create: course.curriculum.map((mod, mIdx) => ({
                  title: mod.title,
                  position: mIdx,
                  chapters: {
                    create: mod.topics.map((topic, cIdx) => {
                      const isFirstChapter = mIdx === 0 && cIdx === 0;
                      const resolvedBrochure = isFirstChapter ? resolveBrochureAttachment(course.brochureUrl) : null;
                      return {
                        title: topic,
                        position: cIdx,
                        duration: '10:00',
                        isFree: isFirstChapter,
                        videoUrl: null,
                        pdfUrl: null,
                        ...(resolvedBrochure
                          ? {
                              attachments: {
                                create: [
                                  {
                                    title: `${course.title} Syllabus & Brochure`,
                                    fileUrl: resolvedBrochure.fileUrl,
                                    fileType: 'PDF' as const,
                                    fileSize: resolvedBrochure.fileSize,
                                    isDownload: true,
                                  },
                                ],
                              },
                            }
                          : {}),
                      };
                    }),
                  },
                })),
              },
            },
            include: {
              modules: {
                include: { chapters: true },
              },
            },
          });

          // Lock & publish the version after modules and chapters are committed
          await tx.courseCurriculumVersion.update({
            where: { id: activeVersion.id },
            data: {
              isPublished: true,
              isLocked: true,
              publishedAt: new Date(),
            },
          });

          await tx.globalCourse.update({
            where: { id: courseId },
            data: { activeCurriculumVersionId: activeVersion.id },
          });

          summary.modulesCreated += modCount;
          summary.chaptersCreated += chapCount;
          console.log(`   ✓ Created Curriculum V1: ${modCount} modules, ${chapCount} lessons`);
        } else {
          // Version already exists
          summary.modulesExisting += activeVersion.modules.length;
          summary.chaptersExisting += activeVersion.modules.reduce((sum, m) => sum + m.chapters.length, 0);
          console.log(`   ✓ Retained existing Curriculum V1 (${activeVersion.modules.length} modules, ${summary.chaptersExisting} lessons)`);
        }

        // Link Franchise Course Selection
        if (permitFranchiseId) {
          const selection = await tx.franchiseCourseSelection.upsert({
            where: {
              franchiseId_courseId: {
                franchiseId: permitFranchiseId,
                courseId,
              },
            },
            update: { isPermitted: true, permittedAt: new Date() },
            create: {
              franchiseId: permitFranchiseId,
              courseId,
              isPermitted: true,
              permittedAt: new Date(),
              isEnabled: true,
            },
          });
          summary.franchiseCourseSelectionCreated = (summary.franchiseCourseSelectionCreated || 0) + 1;
          console.log(`   ✓ Permitted course for franchise (${permitFranchiseId})`);
        }
      }, { maxWait: 25000, timeout: 90000 });
    }

    console.log('\n============================================================');
    console.log(` CATALOGUE IMPORT ${dryRun ? 'DRY-RUN VALIDATION COMPLETE' : 'SUCCESSFULLY APPLIED'}`);
    console.log('============================================================');
    console.log(JSON.stringify({ dryRun, schema, ...summary }, null, 2));
    console.log('============================================================\n');

    return summary;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && process.argv[1].endsWith('import-catalogue.ts')) {
  importCatalogue().catch((err) => {
    console.error('❌ Catalogue import failed:', err);
    process.exit(1);
  });
}
