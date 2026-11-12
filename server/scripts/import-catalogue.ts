import 'dotenv/config';
import { PrismaClient, CourseStatus } from '@prisma/client';

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
    else if (arg === '--allow-prod') allowProd = true;
    else if (arg.startsWith('--schema=')) schema = arg.split('=')[1] || 'public';
    else if (arg.startsWith('--permit-franchise-id=')) permitFranchiseId = arg.split('=')[1] || undefined;
  }

  if (schema === 'public' && !dryRun && !allowProd) {
    console.warn('⚠️  Targeting live public schema without --dry-run or --allow-prod. Defaulting safely to DRY-RUN mode.');
    dryRun = true;
  }

  return { dryRun, schema, allowProd, permitFranchiseId };
}

const SOURCE_CATEGORIES = [
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

const SOURCE_COURSES = [
  {
    slug: 'ai-powered-digital-marketing',
    categorySlug: 'marketing-ai',
    title: 'AI-Powered Digital Marketing Course',
    subTitle: 'The New Digital Marketing + AI Course',
    description:
      'Digital marketing combined with AI is rapidly transforming how businesses grow and compete. Learn to build strong marketing foundations, leverage AI for faster execution, and create high-performing campaigns.',
    format: 'Classroom + Online',
    duration: '3 to 6 Months',
    level: 'Beginner to Advanced',
    price: 0,
    status: CourseStatus.PUBLISHED,
    thumbnailUrl: '/uploads/courses/1789123754349-ai-powered-digital-marketing-course-card.webp',
    bannerUrl: '/uploads/courses/1789123324736-ai-powered-digital-marketing-banner.jpg.webp',
    brochureUrl: '/Courses/AI Powered Digital Marketing Course.pdf',
    learningOutcomes: [
      'Understand the digital ecosystem and customer journey',
      'Learn prompt engineering and AI content creation using ChatGPT & Midjourney',
      'Plan and create engaging social media strategies across platforms',
      'Master Instagram algorithm, reels, and influencer marketing',
      'Build a strong personal brand on LinkedIn and generate B2B leads',
      'Create high-converting landing pages and sales funnels',
      'Automate email, WhatsApp marketing, and CRM workflows',
      'Run profitable Facebook, Instagram, and Google Ads campaigns',
      'Build websites using WordPress and optimize for SEO',
      'Design professional creatives using Canva and AI design tools',
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
        'Digital marketing combined with AI is rapidly transforming how businesses grow and compete. This course gives you a complete roadmap to build strong marketing foundations, leverage AI for faster execution, and create high-performing campaigns.',
        'At Digital Ghuru, we believe that the future belongs to those who can create, communicate, and convert effectively in the digital world. With the rise of AI tools like ChatGPT and Midjourney, marketing is no longer just about creativity — it is about speed, automation, and smart decision-making.',
        'We ensure our students do not just learn — they practice, implement, and achieve real results. By the end of this program, you will have hands-on project experience, a professional portfolio, and the confidence to pursue a career as a Digital Marketing Executive, SEO Specialist, Social Media Manager, Content Strategist, Performance Marketer, or Freelancer.',
      ],
      overviewLearnings: [
        'Understand the digital ecosystem and customer journey',
        'Learn prompt engineering and AI content creation using ChatGPT & Midjourney',
        'Plan and create engaging social media strategies across platforms',
        'Master Instagram algorithm, reels, and influencer marketing',
        'Build a strong personal brand on LinkedIn and generate B2B leads',
        'Create high-converting landing pages and sales funnels',
        'Automate email, WhatsApp marketing, and CRM workflows',
        'Run profitable Facebook, Instagram, and Google Ads campaigns',
        'Build websites using WordPress and optimize for SEO',
        'Design professional creatives using Canva and AI design tools',
      ],
      whoIsThisForData: [
        {
          role: 'Entrepreneurs',
          title: 'Entrepreneurs',
          iconName: 'TrendingUp',
          desc: 'An all-inclusive program designed to empower your entrepreneurial journey in the digital world.',
          description: 'An all-inclusive program designed to empower your entrepreneurial journey in the digital world.',
          points: [
            'Build a strong online presence for your business',
            'Generate quality leads and increase sales',
            'Stay ahead using AI-powered marketing strategies',
          ],
          bullets: [
            'Build a strong online presence for your business',
            'Generate quality leads and increase sales',
            'Stay ahead using AI-powered marketing strategies',
          ],
        },
        {
          role: 'Professionals',
          title: 'Professionals',
          iconName: 'Briefcase',
          desc: 'A career-focused program to help you upgrade your skills and grow in the digital space.',
          description: 'A career-focused program to help you upgrade your skills and grow in the digital space.',
          points: [
            'Learn in-demand digital marketing & AI skills',
            'Transition into high-growth digital roles',
            'Enhance your career opportunities and salary potential',
          ],
          bullets: [
            'Learn in-demand digital marketing & AI skills',
            'Transition into high-growth digital roles',
            'Enhance your career opportunities and salary potential',
          ],
        },
        {
          role: 'Students',
          title: 'Students',
          iconName: 'GraduationCap',
          desc: 'A complete beginner-friendly program to kickstart your digital marketing career.',
          description: 'A complete beginner-friendly program to kickstart your digital marketing career.',
          points: [
            'Gain practical, job-ready skills',
            'Work on real-time projects and build your portfolio',
            'Prepare for interviews and career opportunities',
          ],
          bullets: [
            'Gain practical, job-ready skills',
            'Work on real-time projects and build your portfolio',
            'Prepare for interviews and career opportunities',
          ],
        },
        {
          role: 'Freelancers',
          title: 'Freelancers',
          iconName: 'Laptop',
          desc: 'A growth-oriented program to help you scale your freelancing career.',
          description: 'A growth-oriented program to help you scale your freelancing career.',
          points: [
            'Expand your service offerings with digital marketing',
            'Attract high-paying clients globally',
            'Build a consistent and scalable income stream',
          ],
          bullets: [
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
      description: 'At Digital Ghuru, we combine Digital Marketing + Artificial Intelligence, creating a powerful learning experience designed for real-world success.',
      benefits: [
        { iconName: 'Blocks', title: 'Build strong marketing foundations', description: 'Master the fundamentals of digital marketing and understand the customer journey.' },
        { iconName: 'Sparkles', title: 'Leverage AI for faster execution', description: 'Use advanced AI tools to automate your workflows and create content at scale.' },
        { iconName: 'Rocket', title: 'Create high-performing campaigns', description: 'Design, execute, and optimize live campaigns that drive real business results.' },
        { iconName: 'Globe2', title: 'Stay ahead in the digital ecosystem', description: 'Future-proof your career by staying updated with the latest AI advancements.' },
      ],
    },
    numberedFeaturesJson: {
      title: 'Rise of AI in Marketing',
      description: 'AI is transforming how businesses operate and market their products. Tools like ChatGPT, Canva, and Google Analytics are revolutionizing the industry.',
      features: [
        { num: '01', iconName: 'BrainCircuit', title: 'Automation to Intelligence', description: 'AI now goes beyond automation to strategic decision-making.' },
        { num: '02', iconName: 'FileImage', title: 'Content Creation at Scale', description: 'Generate text, images, and videos instantly.' },
        { num: '03', iconName: 'BarChart3', title: 'Data-Driven Marketing', description: 'Analyze customer behavior with precision.' },
        { num: '04', iconName: 'UserCog', title: 'Personalization', description: 'Deliver customized experiences to every user.' },
      ],
    },
    whyDigitalGhuruJson: {
      title: 'Why Digital Ghuru',
      reasons: [
        { num: '01', iconName: 'Search', title: 'AI Integration', description: 'Dedicated modules on using AI tools for content creation, automation, and campaign optimization' },
        { num: '02', iconName: 'PenTool', title: 'Practical Learning Approach', description: 'Learn by working on real-time projects and campaigns' },
        { num: '03', iconName: 'RefreshCcw', title: 'Updated Curriculum', description: 'Aligned with current industry trends and AI advancements' },
        { num: '04', iconName: 'Laptop2', title: 'Hands-On Experience', description: 'Execute campaigns, build funnels, and manage live projects' },
        { num: '05', iconName: 'Users', title: 'Personal Mentorship', description: 'Guidance from experienced digital marketers' },
        { num: '06', iconName: 'DollarSign', title: 'Freelancing & Earning Support', description: 'Learn how to earn through digital skills' },
        { num: '07', iconName: 'FolderOpen', title: 'Portfolio Building', description: 'Create proof of work to showcase your expertise' },
      ],
    },
    topHighlightsJson: [
      { iconName: 'Users', title: 'Personal Mentorship', description: 'Get 1-on-1 guidance from industry experts with personalized feedback on your campaigns.' },
      { iconName: 'Lightbulb', title: 'Practical Learning Approach', description: 'Hands-on experience with real-time projects, live campaigns, and case studies.' },
      { iconName: 'Bot', title: 'Updated Curriculum with AI', description: 'Learn AI-based content automation, chatbot marketing, ad optimization, and more.' },
      { iconName: 'FolderKanban', title: 'Portfolio Building', description: 'Build a strong portfolio showcasing projects, creativity, and measurable results.' },
      { iconName: 'BriefcaseBusiness', title: 'Freelancing & Earning Support', description: 'Learn freelance client acquisition, pricing strategies, and how to build consistent income.' },
      { iconName: 'Award', title: 'Industry Certifications', description: 'Earn Digital Ghuru certification plus industry-recognized certifications from Google and Meta.' },
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
  {
    slug: 'react-js-full-stack-development',
    categorySlug: 'full-stack-development',
    title: 'React JS Full Stack Development Course',
    subTitle: 'Master Frontend, Backend & Full Stack Web Development',
    description:
      "In today's digital-first world, businesses demand fast, scalable, and highly interactive web applications. The React JS Full Stack Developer Program at Digital Ghuru is designed to transform beginners into industry-ready developers by combining frontend excellence with powerful backend development.",
    format: 'Online & Offline Campuses',
    duration: '4 to 6 Months',
    level: 'Beginner to Industry-Ready',
    price: 0,
    status: CourseStatus.PUBLISHED,
    thumbnailUrl: '/uploads/courses/1789124003189-react-js-full-stack-developer-course-card.webp',
    bannerUrl: '/uploads/courses/1789124027228-react-js-full-stack-developer-banner.jpg.webp',
    brochureUrl: '/Courses/React JS Full Stack Development.pdf',
    learningOutcomes: [
      'Master modern frontend development with React JS',
      'Build highly scalable backends with Node.js and Express',
      'Design and manage NoSQL databases with MongoDB',
      'Create full-stack applications with user authentication',
      'Understand industry standard workflows using Git & GitHub',
      'Gain exposure to agile development practices and real client requirements',
    ],
    targetAudience: ['Entrepreneurs', 'Professionals', 'Students', 'Freelancers'],
    toolsCovered: ['React', 'Node.js', 'Express', 'MongoDB', 'Redux', 'Tailwind CSS', 'Postman', 'Vercel & Render'],
    overviewJson: {
      batchInfo: 'New Batches Starting Soon | 7 Modules',
      location: 'Online & Offline Campuses',
      originalPrice: '—',
      discountedPrice: 'Contact Us',
      showCareerFeatures: true,
      overviewDescription: [
        'This program is not just about learning coding — it is about building real-world products, solving business problems, and becoming job-ready with confidence.',
        'Unlike traditional courses, this program emphasizes hands-on implementation over theory, real-time project experience, industry tools and workflows, and a problem-solving approach designed to simulate real IT company workflows.',
      ],
      overviewLearnings: [
        'Master modern frontend development with React JS',
        'Build highly scalable backends with Node.js and Express',
        'Design and manage NoSQL databases with MongoDB',
        'Create full-stack applications with user authentication',
        'Understand industry standard workflows using Git & GitHub',
        'Gain exposure to agile development practices and real client requirements',
      ],
      whoIsThisForData: [
        {
          role: 'Entrepreneurs',
          title: 'Entrepreneurs',
          iconName: 'TrendingUp',
          desc: 'An all-inclusive program designed to empower your entrepreneurial journey in the digital world.',
          description: 'An all-inclusive program designed to empower your entrepreneurial journey in the digital world.',
          points: [
            'Build scalable web products for your business',
            'Understand full-stack product architecture',
            'Launch rapid MVPs with AI-assisted coding',
          ],
          bullets: [
            'Build scalable web products for your business',
            'Understand full-stack product architecture',
            'Launch rapid MVPs with AI-assisted coding',
          ],
        },
        {
          role: 'Professionals',
          title: 'Professionals',
          iconName: 'Briefcase',
          desc: 'A career-focused program to help you upgrade your skills and transition into full-stack roles.',
          description: 'A career-focused program to help you upgrade your skills and transition into full-stack roles.',
          points: [
            'Modern React Hooks & API integration',
            'Scalable Node.js & Express backends',
            'Real deployment workflows',
          ],
          bullets: [
            'Modern React Hooks & API integration',
            'Scalable Node.js & Express backends',
            'Real deployment workflows',
          ],
        },
        {
          role: 'Students',
          title: 'Students',
          iconName: 'GraduationCap',
          desc: 'Build production full-stack projects from scratch and get placement-ready.',
          description: 'Build production full-stack projects from scratch and get placement-ready.',
          points: [
            'Master MERN Stack',
            'Hands-on Capstone projects',
            'Interview & portfolio prep',
          ],
          bullets: [
            'Master MERN Stack',
            'Hands-on Capstone projects',
            'Interview & portfolio prep',
          ],
        },
        {
          role: 'Freelancers',
          title: 'Freelancers',
          iconName: 'Laptop',
          desc: 'A growth-oriented program to build and ship custom client web applications.',
          description: 'A growth-oriented program to build and ship custom client web applications.',
          points: [
            'Deliver end-to-end client web applications',
            'Attract high-paying software projects globally',
            'Accelerate delivery with AI developer tools',
          ],
          bullets: [
            'Deliver end-to-end client web applications',
            'Attract high-paying software projects globally',
            'Accelerate delivery with AI developer tools',
          ],
        },
      ],
      categorizedToolsData: [
        {
          category: 'Frontend Development',
          title: 'Frontend Development:',
          description: 'You will learn how to design responsive and visually appealing user interfaces.',
          bgClass: 'bg-white',
          textClass: 'text-[#0d2f62]',
          tools: [
            { name: 'HTML5', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-original.svg' },
            { name: 'CSS3', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-original.svg' },
            { name: 'JavaScript', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg' },
            { name: 'React', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original-wordmark.svg' },
          ],
        },
        {
          category: 'Backend Development',
          title: 'Backend Development:',
          description: 'Learn how to build powerful server-side applications.',
          bgClass: 'bg-[#ffe358]',
          textClass: 'text-[#0d2f62]',
          tools: [
            { name: 'Node.js', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nodejs/nodejs-original-wordmark.svg' },
            { name: 'Express', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/express/express-original-wordmark.svg' },
            { name: 'JavaScript', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg' },
          ],
        },
        {
          category: 'Database Management',
          title: 'Database Management:',
          description: 'Database Management is the organized storage and handling of data.',
          bgClass: 'bg-[#ffe358]',
          textClass: 'text-[#0d2f62]',
          tools: [
            { name: 'MongoDB', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mongodb/mongodb-original-wordmark.svg' },
          ],
        },
        {
          category: 'Development Tools',
          title: 'Development Tools:',
          description: 'Development Tools are software used to create, test, and maintain applications.',
          bgClass: 'bg-white',
          textClass: 'text-[#0d2f62]',
          tools: [
            { name: 'Git', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg' },
            { name: 'VS Code', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vscode/vscode-original.svg' },
            { name: 'GitHub', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/github/github-original.svg' },
            { name: 'Postman', iconUrl: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postman/postman-original.svg' },
          ],
        },
      ],
    },
    designedToHelpJson: {
      title: 'What Makes This Program Unique?',
      description: 'We focus on building strong technical foundations while offering practical exposure to actual industry requirements.',
      benefits: [
        { iconName: 'Code2', title: 'Learn by building real applications', description: 'Skip the theory and start coding from day one. Build interactive web applications.' },
        { iconName: 'BriefcaseBusiness', title: 'Work on industry-based assignments', description: 'Solve real business problems using modern MERN stack technologies.' },
        { iconName: 'Users', title: 'Practice coding with mentorship guidance', description: 'Get code reviews and personalized feedback from industry professionals.' },
        { iconName: 'TerminalSquare', title: 'Get exposure to agile practices', description: 'Understand real client requirements and collaborate efficiently.' },
      ],
    },
    numberedFeaturesJson: {
      title: 'Why React Full Stack?',
      description: 'React has become the backbone of modern frontend development, used by top companies to build high-performance user interfaces.',
      features: [
        { num: '01', iconName: 'Globe2', title: 'High Demand', description: 'High demand in global and Indian IT job market.' },
        { num: '02', iconName: 'Blocks', title: 'Independent Building', description: 'Ability to build complete applications independently.' },
        { num: '03', iconName: 'Rocket', title: 'Faster Development', description: 'Faster development with reusable components.' },
        { num: '04', iconName: 'LayoutTemplate', title: 'Strong Ecosystem', description: 'Continuous growth and immense community support.' },
      ],
    },
    whyDigitalGhuruJson: {
      title: 'AI-Powered Development',
      reasons: [
        { num: '01', iconName: 'Cpu', title: 'Code Writing', description: 'Writing code using AI assistance for faster development' },
        { num: '02', iconName: 'Search', title: 'Debugging', description: 'Efficiently finding and fixing bugs using AI tools' },
        { num: '03', iconName: 'RefreshCcw', title: 'Automation', description: 'Automating repetitive tasks to focus on logic' },
        { num: '04', iconName: 'TrendingUp', title: 'Productivity', description: 'Improving overall developer productivity using AI' },
      ],
    },
    topHighlightsJson: [
      { iconName: 'Code2', title: 'End-to-End Training', description: 'Full Stack Development Training from UI design to scalable backend architecture.' },
      { iconName: 'Laptop2', title: '80% Practical Learning', description: 'Project-based learning with a focus on real-time assignments and projects.' },
      { iconName: 'Bot', title: 'AI-Powered Workflow', description: 'Learn how AI tools are integrated into modern development workflows.' },
      { iconName: 'BriefcaseBusiness', title: 'Placement Assistance', description: 'Get internship and placement support after successful program completion.' },
      { iconName: 'Users', title: 'Expert Designed', description: 'Industry-Oriented Curriculum Designed by Experts who work in top tech companies.' },
      { iconName: 'Workflow', title: 'Lifetime Support', description: 'Lifetime Learning & Support Access to keep up with new technology changes.' },
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

async function main() {
  const { dryRun, schema, permitFranchiseId } = parseArgs();
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error('DATABASE_URL is missing in environment');
  }

  console.log(`\n=== Digital Guru Source Catalogue Importer ===`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'EXECUTE'} | Target Schema: ${schema}`);
  console.log(`Authentic Source Catalogue Count: ${SOURCE_COURSES.length} courses, ${SOURCE_CATEGORIES.length} categories\n`);

  const prisma = new PrismaClient({
    datasources: { db: { url: withSchemaUrl(baseUrl, schema) } },
  });

  const summary = {
    categoriesCreated: 0,
    categoriesSkipped: 0,
    coursesCreated: 0,
    coursesSkipped: 0,
    modulesCreated: 0,
    chaptersCreated: 0,
  };

  try {
    const categoryIdBySlug = new Map<string, string>();

    for (const cat of SOURCE_CATEGORIES) {
      const existing = await prisma.courseCategory.findUnique({ where: { slug: cat.slug } });
      if (existing) {
        categoryIdBySlug.set(cat.slug, existing.id);
        summary.categoriesSkipped++;
        console.log(`[Category] SKIP (already exists): ${cat.name} (${cat.slug})`);
      } else if (dryRun) {
        categoryIdBySlug.set(cat.slug, `dry-run-${cat.slug}`);
        summary.categoriesCreated++;
        console.log(`[Category] WOULD CREATE: ${cat.name} (${cat.slug})`);
      } else {
        const created = await prisma.courseCategory.create({ data: cat });
        categoryIdBySlug.set(cat.slug, created.id);
        summary.categoriesCreated++;
        console.log(`[Category] CREATED: ${created.name} (${created.id})`);
      }
    }

    for (const course of SOURCE_COURSES) {
      const existingBySlug = await prisma.globalCourse.findUnique({ where: { slug: course.slug } });
      const existingByAlias = existingBySlug
        ? null
        : await prisma.courseSlugAlias.findUnique({ where: { slug: course.slug } });

      if (existingBySlug || existingByAlias) {
        summary.coursesSkipped++;
        console.log(
          `[Course] SKIP (already exists via ${existingBySlug ? 'slug' : 'alias'}): ${course.title} (${course.slug})`
        );
        continue;
      }

      const modCount = course.curriculum.length;
      const chapCount = course.curriculum.reduce((sum, m) => sum + m.topics.length, 0);

      if (dryRun) {
        summary.coursesCreated++;
        summary.modulesCreated += modCount;
        summary.chaptersCreated += chapCount;
        console.log(
          `[Course] WOULD CREATE: ${course.title} (${course.slug}) | ${modCount} modules | ${chapCount} lessons | Status=${course.status}`
        );
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const createdCourse = await tx.globalCourse.create({
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

        const version = await tx.courseCurriculumVersion.create({
          data: {
            courseId: createdCourse.id,
            version: 1,
            title: 'Version 1.0 (Source Catalogue Import)',
            isPublished: false,
            isLocked: false,
            modules: {
              create: course.curriculum.map((mod, mIdx) => ({
                title: mod.title,
                position: mIdx,
                chapters: {
                  create: mod.topics.map((topic, cIdx) => ({
                    title: topic,
                    position: cIdx,
                    duration: '15:00',
                    isFree: mIdx === 0 && cIdx === 0,
                  })),
                },
              })),
            },
          },
        });

        if (course.status === CourseStatus.PUBLISHED) {
          await tx.courseCurriculumVersion.update({
            where: { id: version.id },
            data: {
              isPublished: true,
              isLocked: true,
              publishedAt: new Date(),
            },
          });
        }

        await tx.globalCourse.update({
          where: { id: createdCourse.id },
          data: { activeCurriculumVersionId: version.id },
        });

        if (permitFranchiseId && course.status === CourseStatus.PUBLISHED) {
          await tx.franchiseCourseSelection.upsert({
            where: {
              franchiseId_courseId: {
                franchiseId: permitFranchiseId,
                courseId: createdCourse.id,
              },
            },
            update: { isPermitted: true, permittedAt: new Date() },
            create: {
              franchiseId: permitFranchiseId,
              courseId: createdCourse.id,
              isPermitted: true,
              permittedAt: new Date(),
              isEnabled: false,
            },
          });
        }
      }, { maxWait: 20000, timeout: 60000 });

      summary.coursesCreated++;
      summary.modulesCreated += modCount;
      summary.chaptersCreated += chapCount;
      console.log(
        `[Course] CREATED: ${course.title} (${course.slug}) | ${modCount} modules | ${chapCount} lessons`
      );
    }

    console.log('\n=== Import Summary ===');
    console.log(JSON.stringify({ dryRun, schema, ...summary }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ Catalogue import failed:', err);
  process.exit(1);
});
