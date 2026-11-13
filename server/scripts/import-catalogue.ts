import 'dotenv/config';
import { PrismaClient, CourseStatus } from '@prisma/client';
import { assertSafeTestDatabase } from '../src/utils/test-db-guard.js';

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
  {
    name: 'Kids & School AI',
    slug: 'kids-school-ai',
    description: 'Young technology leadership, Python programming, and foundational AI for schools.',
    icon: 'GraduationCap',
    sortOrder: 3,
  },
  {
    name: 'Data Science & AI',
    slug: 'data-science-ai',
    description: 'Statistical machine learning, deep learning, NLP, computer vision, and predictive analytics.',
    icon: 'BrainCircuit',
    sortOrder: 4,
  },
  {
    name: 'Design & Creative Media',
    slug: 'design-media',
    description: 'Graphic design, brand identity, motion graphics, UI/UX, and professional video editing.',
    icon: 'PenTool',
    sortOrder: 5,
  },
];

export const SOURCE_COURSES = [
  // 1. AI-POWERED DIGITAL MARKETING
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

  // 2. REACT JS FULL STACK DEVELOPMENT
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

  // 3. AI SUPER KIDS - AI FUTURE LEADERS (GRADES 11-12)
  {
    slug: 'ai-super-kids-grade-11-12',
    slugAliases: ['ai-super-kids', 'ai-future-leaders-11-12'],
    categorySlug: 'kids-school-ai',
    title: 'AI Super Kids - AI Future Leaders Grade 11-12',
    subTitle: 'Advanced AI, Python & Future Leadership for Grades 11-12',
    description:
      'Advanced learning for higher education, AI careers, entrepreneurship and responsible technology leadership.',
    format: 'Live and Online',
    duration: '16 Weeks',
    level: 'High School (Grades 11-12)',
    price: 15000,
    status: CourseStatus.PUBLISHED,
    thumbnailUrl: '/uploads/courses/1789120752643-image-1.webp',
    bannerUrl: '/uploads/courses/1789123324736-ai-powered-digital-marketing-banner.jpg.webp',
    brochureUrl: '/uploads/courses/1789968532026-ai-super-kids-grade-7-to-8-brochure.pdf',
    learningOutcomes: [
      'Python Fundamentals & Data Handling: Organise, clean and analyse simple datasets.',
      'Data Visualisation & Machine Learning: Understand data, features, models and predictions.',
      'Generative AI & Prompt Engineering: Explore modern content and task support.',
      'API & AI Automation: Connect tools, data and AI-supported workflows.',
      'AI Product Development & Research: Plan an AI service around a clear user need.',
      'Business Models & Startup Strategy: Explore value, customers, revenue and costs.',
      'Portfolio & Career Readiness: Organise projects, presentations, resumes, and interview skills.',
    ],
    targetAudience: ['High School Students (Grades 11-12)', 'Future Tech Leaders', 'Aspiring AI Engineers'],
    toolsCovered: ['Python', 'ChatGPT', 'OpenAI', 'Jupyter', 'Pandas', 'Matplotlib', 'Scikit-learn', 'Streamlit'],
    overviewJson: {
      batchInfo: 'Grades 11-12 Cohort | 16 Modules',
      location: 'Live Online + Partner School Innovation Labs',
      originalPrice: '15000',
      discountedPrice: '12000',
      showCareerFeatures: true,
      usps: [
        'School Partnership Program',
        'Technical Learning Path with Python & AI',
        'Career Pathways & Portfolio Development',
        'Responsible Technology Leadership',
        'Capstone Project & Showcase',
      ],
      overviewDescription: [
        'Students develop practical foundations in programming, data analysis, machine learning and connected AI services.',
        'Students connect technical learning with product development, career pathways and professional communication.',
        'The capstone combines technical knowledge, research, responsible design, testing and presentation to prepare students for technical capability, product thinking and leadership.',
      ],
      overviewLearnings: [
        'Python Fundamentals & Data Handling: Organise, clean and analyse simple datasets.',
        'Data Visualisation & Machine Learning: Understand data, features, models and predictions.',
        'Generative AI & Prompt Engineering: Explore modern content and task support.',
        'API & AI Automation: Connect tools, data and AI-supported workflows.',
        'AI Product Development & Research: Plan an AI service around a clear user need.',
        'Business Models & Startup Strategy: Explore value, customers, revenue and costs.',
        'Portfolio & Career Readiness: Organise projects, presentations, resumes, and interview skills.',
      ],
      whoIsThisForData: [
        {
          role: 'High School Students (Grades 11-12)',
          title: 'High School Students (Grades 11-12)',
          iconName: 'GraduationCap',
          desc: 'Advanced learning for higher education, AI careers, entrepreneurship and responsible technology leadership.',
          description: 'Advanced learning for higher education, AI careers, entrepreneurship and responsible technology leadership.',
          points: [
            'Python, Data Analysis, and Machine Learning',
            'AI Product Development and Startup Strategy',
            'Portfolio building and Career Readiness',
          ],
          bullets: [
            'Python, Data Analysis, and Machine Learning',
            'AI Product Development and Startup Strategy',
            'Portfolio building and Career Readiness',
          ],
        },
      ],
      categorizedToolsData: [
        {
          category: 'AI & Technical Tools',
          title: 'AI & Technical Tools',
          description: 'Learn modern tools for programming and AI development.',
          bgClass: 'bg-white',
          textClass: 'text-[#0d2f62]',
          tools: [
            { name: 'Python', iconUrl: '/tools/openai.svg' },
            { name: 'ChatGPT', iconUrl: '/tools/openai.svg' },
            { name: 'Code.org', iconUrl: '/tools/codeorg.svg' },
            { name: 'Scratch', iconUrl: '/tools/scratch.svg' },
          ],
        },
      ],
    },
    designedToHelpJson: {
      title: 'This course is designed to help high schoolers lead with AI',
      description: 'Empowering future leaders with programming, data intelligence, and venture readiness.',
      benefits: [
        { iconName: 'Blocks', title: 'Solid Python Programming Foundations', description: 'Move beyond visual blocks to industry standard Python programming and algorithms.' },
        { iconName: 'Sparkles', title: 'Data Analysis & Machine Learning', description: 'Analyze real-world data, evaluate accuracy, and understand how intelligent models make decisions.' },
        { iconName: 'Rocket', title: 'AI Venture & Product Prototyping', description: 'Learn product thinking, user research, and how to create AI-driven applications.' },
        { iconName: 'Globe2', title: 'Responsible AI Leadership', description: 'Understand ethical implications, privacy, and safety in autonomous AI systems.' },
      ],
    },
    numberedFeaturesJson: {
      title: 'AI Capstone Project (From Learning to Leadership)',
      description: 'The capstone combines technical knowledge, research, responsible design, testing and presentation.',
      features: [
        { num: '01', iconName: 'Search', title: 'Capstone Development Process', description: 'Identify, Research, Design, Develop, Test, Improve, and Present.' },
        { num: '02', iconName: 'FileText', title: 'Final Submission', description: 'Problem research, Technical workflow, Prototype or proof of concept, Responsible AI review, and Final demonstration.' },
        { num: '03', iconName: 'CheckCircle', title: 'Suggested Capstone Areas', description: 'Education, Healthcare awareness, Agriculture, Sustainability, Accessibility, and Community development.' },
        { num: '04', iconName: 'Target', title: 'Student Portfolio & Outcomes', description: 'Python, Data projects, AI activities, Product concepts, Capstone, and Verified Certification.' },
      ],
    },
    whyDigitalGhuruJson: {
      title: 'Why Choose the AI Future Leaders Program?',
      reasons: [
        { num: '01', iconName: 'Users', title: 'School Partnership Program', description: 'Advanced learning for higher education, AI careers, entrepreneurship and responsible technology leadership.' },
        { num: '02', iconName: 'Laptop2', title: 'Technical Learning Path', description: 'Code, Analyse data, Model concepts, Connect tools, Automate, and Build applications.' },
        { num: '03', iconName: 'Target', title: 'Career Preparation', description: 'Career pathways, Portfolio, Resume, Interview skills, and Entrepreneurship guidance.' },
      ],
    },
    topHighlightsJson: [
      { iconName: 'Award', title: 'School Partnership Curriculum', description: 'Specially engineered for students in Grades 11 & 12 aiming for STEM and AI majors.' },
      { iconName: 'Cpu', title: 'Full Technical AI Stack', description: 'Hands-on Python, Data science, Machine learning, and LLM prompt engineering.' },
      { iconName: 'Rocket', title: 'Startup & Leadership Track', description: 'Product design, business models, and startup fundamentals.' },
    ],
    faqsJson: [
      { question: 'Is prior coding knowledge required?', answer: 'No prior experience is necessary. We start from basic Python syntax and progress into AI models.' },
      { question: 'What grade levels is this suited for?', answer: 'This course is tailored specifically for students in Grades 11 and 12.' },
      { question: 'Will students receive a certificate?', answer: 'Yes, students receive a verified Digital Guru Future Leaders Certificate upon capstone completion.' },
    ],
    curriculum: [
      { title: 'Module 1: Python Fundamentals', topics: ['Use variables, conditions, loops and functions.', 'Writing clean Python scripts', 'Debugging common runtime errors'] },
      { title: 'Module 2: Data Handling with Python', topics: ['Organise, clean and analyse simple datasets.', 'Working with CSV files', 'Data transformation fundamentals'] },
      { title: 'Module 3: Data Visualisation', topics: ['Communicate findings through clear charts.', 'Plotting with Matplotlib and Seaborn', 'Interactive dashboards'] },
      { title: 'Module 4: Machine Learning Fundamentals', topics: ['Understand data, features, models and predictions.', 'Supervised vs Unsupervised learning', 'Evaluating accuracy'] },
      { title: 'Module 5: Generative AI and Language Models', topics: ['Explore modern content and task support.', 'How LLMs process natural language', 'Creative problem solving'] },
      { title: 'Module 6: Prompt Engineering', topics: ['Use context, constraints, examples and formats.', 'Zero-shot and Few-shot prompting', 'Chaining prompts for complex workflows'] },
      { title: 'Module 7: Application Programming Interfaces', topics: ['Learn how applications exchange information.', 'REST API basics', 'Calling OpenAI endpoints'] },
      { title: 'Module 8: AI Automation', topics: ['Connect tools, data and AI-supported workflows.', 'Trigger-based automation', 'Building intelligent chatbots'] },
      { title: 'Module 9: AI Product Development', topics: ['Plan an AI service around a clear user need.', 'Wireframing and user stories', 'Rapid MVP prototyping'] },
      { title: 'Module 10: Market and User Research', topics: ['Study users, industries and current solutions.', 'Conducting user interviews', 'Competitive landscape analysis'] },
      { title: 'Module 11: Business Models and Startup Strategy', topics: ['Explore value, customers, revenue and costs.', 'Unit economics for AI startups', 'Pitch deck structure'] },
      { title: 'Module 12: Introduction to AI Agents', topics: ['Understand tool use and multi-step task planning.', 'Autonomous task delegation', 'Agentic safety and ethics'] },
      { title: 'Module 13: Future AI Careers', topics: ['Explore technical, product and research pathways.', 'Emerging roles in the AI industry', 'College program recommendations'] },
      { title: 'Module 14: Portfolio Development', topics: ['Organise projects, presentations and achievements.', 'Hosting projects on GitHub', 'Building a showcase website'] },
      { title: 'Module 15: Resume and LinkedIn Preparation', topics: ['Present skills and experience professionally.', 'Highlighting hands-on projects', 'Networking with industry mentors'] },
      { title: 'Module 16: Interview and Presentation Skills', topics: ['Explain projects clearly and confidently.', 'Technical demo rehearsals', 'Final Capstone demonstration'] },
    ],
  },

  // 4. DATA SCIENCE WITH AI
  {
    slug: 'data-science-with-ai',
    categorySlug: 'data-science-ai',
    title: 'Advanced Data Science with AI Program',
    subTitle: 'Master Data Analysis, Machine Learning & AI',
    description:
      'Learn to analyze complex data, build predictive models, and leverage artificial intelligence to solve real-world business problems.',
    format: 'Online & Offline Campuses',
    duration: '4 to 6 Months',
    level: 'Intermediate to Advanced',
    price: 0,
    status: CourseStatus.PUBLISHED,
    thumbnailUrl: '/uploads/courses/1789124003189-react-js-full-stack-developer-course-card.webp',
    bannerUrl: '/uploads/courses/1789124027228-react-js-full-stack-developer-banner.jpg.webp',
    brochureUrl: '/Courses/Data Science with AI Course.pdf',
    learningOutcomes: [
      'Analyze and interpret complex datasets using Python and SQL',
      'Build and evaluate predictive machine learning models',
      'Develop deep learning architectures with TensorFlow and Keras',
      'Create interactive data visualizations and business dashboards',
      'Master Natural Language Processing and Generative AI workflows',
      'Deploy production-ready machine learning pipelines to cloud infrastructure',
    ],
    targetAudience: ['Data Enthusiasts', 'Software Developers', 'Business Analysts', 'Graduates'],
    toolsCovered: ['Python', 'SQL', 'Pandas & NumPy', 'Scikit-Learn', 'TensorFlow & Keras', 'Tableau / PowerBI', 'Jupyter Notebooks', 'Git & GitHub'],
    overviewJson: {
      batchInfo: 'New Batches Starting Soon | 14 Modules',
      location: 'Online & Offline Campuses',
      originalPrice: '—',
      discountedPrice: 'Contact Us',
      showCareerFeatures: true,
      usps: [
        'Industry-Relevant Curriculum',
        'Hands-on Real-Time Projects',
        'Expert Trainers',
        'AI & Machine Learning Focus',
        'Placement Guidance',
        'Portfolio Building',
      ],
      overviewDescription: [
        'In this program, you will transition from fundamental data operations into state-of-the-art predictive modeling and machine learning applications.',
        'Through practical assignments, you will master data storytelling, advanced statistical hypothesis testing, and deep neural networks applied to production engineering.',
      ],
      overviewLearnings: [
        'Python for Data Science & Pandas DataFrames',
        'Interactive Dashboards with Plotly and Seaborn',
        'Supervised & Unsupervised Machine Learning Algorithms',
        'Deep Learning with TensorFlow & Keras',
        'Natural Language Processing & Large Language Models',
        'Cloud Deployment & Production Model Monitoring',
      ],
      whoIsThisForData: [
        {
          role: 'Data Enthusiasts',
          title: 'Data Enthusiasts',
          iconName: 'BarChart3',
          desc: 'Start a career in data science and business intelligence.',
          description: 'Start a career in data science and business intelligence.',
          points: ['Learn Python and SQL', 'Understand data visualization', 'Master data storytelling'],
          bullets: ['Learn Python and SQL', 'Understand data visualization', 'Master data storytelling'],
        },
        {
          role: 'Developers',
          title: 'Developers',
          iconName: 'Code2',
          desc: 'Transition into Machine Learning and Artificial Intelligence engineering.',
          description: 'Transition into Machine Learning and Artificial Intelligence engineering.',
          points: ['Master ML algorithms', 'Build AI models', 'Deploy model APIs'],
          bullets: ['Master ML algorithms', 'Build AI models', 'Deploy model APIs'],
        },
      ],
      categorizedToolsData: [
        {
          category: 'Data Science & ML',
          description: 'Core scientific computing libraries and platforms.',
          tools: [
            { name: 'Python', iconUrl: '/tools/openai.svg' },
            { name: 'Pandas', iconUrl: '/tools/openai.svg' },
            { name: 'Google Ads', iconUrl: '/tools/googleads.svg' },
          ],
        },
      ],
    },
    designedToHelpJson: {
      title: 'Designed for Real-World Data & AI Intelligence',
      description: 'Master quantitative analysis, predictive modeling, and modern AI algorithms.',
      benefits: [
        { iconName: 'Blocks', title: 'Data Wrangling at Scale', description: 'Clean, transform, and analyze multi-gigabyte datasets with Pandas and SQL.' },
        { iconName: 'Sparkles', title: 'Predictive Modeling', description: 'Train supervised regression, classification, and ensemble algorithms.' },
        { iconName: 'Rocket', title: 'Deep Learning & GenAI', description: 'Build neural networks and integrate foundational language models.' },
      ],
    },
    numberedFeaturesJson: {
      title: 'Core Pillars of Data Science with AI',
      description: 'A structured path from raw data to intelligent production systems.',
      features: [
        { num: '01', iconName: 'BarChart3', title: 'Statistical Analysis', description: 'Rigorous hypothesis testing, probability, and exploratory data analysis.' },
        { num: '02', iconName: 'BrainCircuit', title: 'Machine Learning', description: 'Regression, Decision Trees, Random Forests, and Gradient Boosting.' },
        { num: '03', iconName: 'Cpu', title: 'Deep Neural Networks', description: 'Computer vision, NLP embeddings, and transformer architectures.' },
      ],
    },
    whyDigitalGhuruJson: {
      title: 'Why Study Data Science with Digital Guru?',
      reasons: [
        { num: '01', iconName: 'Search', title: 'Hands-on Projects', description: 'Analyze authentic production datasets from finance, retail, and tech.' },
        { num: '02', iconName: 'Users', title: 'Industry Mentorship', description: 'Learn directly from practicing senior data scientists and ML engineers.' },
      ],
    },
    topHighlightsJson: [
      { iconName: 'Award', title: 'Industry Recognized Credentials', description: 'Graduate with certified data science proof-of-work.' },
      { iconName: 'BriefcaseBusiness', title: 'Placement Assistance', description: 'Dedicated interview preparation, portfolio reviews, and resume polishing.' },
    ],
    faqsJson: [
      { question: 'Do I need prior math or coding experience?', answer: 'We begin with basic Python and statistics fundamentals, making it accessible to committed beginners.' },
      { question: 'What tools are covered?', answer: 'Python, SQL, Pandas, NumPy, Scikit-Learn, TensorFlow, and PowerBI.' },
    ],
    curriculum: [
      { title: 'Module 1: Introduction to Data Science', topics: ['What is Data Science?', 'Data Science Lifecycle', 'Applications of Data Science', 'Data Ethics'] },
      { title: 'Module 2: Python for Data Science', topics: ['Python Basics', 'Data Structures', 'Functions & Modules', 'Object-Oriented Programming'] },
      { title: 'Module 3: Data Manipulation with Pandas', topics: ['Series & DataFrames', 'Data Cleaning', 'Handling Missing Values', 'Data Aggregation'] },
      { title: 'Module 4: Data Visualization', topics: ['Matplotlib & Seaborn', 'Plotly Dashboards', 'Data Storytelling'] },
      { title: 'Module 5: Statistical Foundations', topics: ['Descriptive Statistics', 'Probability Distributions', 'Hypothesis Testing', 'A/B Testing'] },
      { title: 'Module 6: SQL for Data Analysis', topics: ['Relational Databases', 'SQL Queries & Joins', 'Window Functions', 'Performance Tuning'] },
      { title: 'Module 7: Machine Learning Basics', topics: ['Supervised vs Unsupervised', 'Model Evaluation', 'Overfitting & Regularization', 'Cross-Validation'] },
      { title: 'Module 8: Supervised Learning Algorithms', topics: ['Linear Regression', 'Logistic Regression', 'Decision Trees', 'Random Forests'] },
      { title: 'Module 9: Deep Learning Foundations', topics: ['Artificial Neural Networks', 'Backpropagation', 'Activation Functions', 'TensorFlow Basics'] },
      { title: 'Module 10: Capstone Project & Deployment', topics: ['End-to-End ML Pipeline', 'Model Serving via FastAPI', 'Portfolio Presentation'] },
    ],
  },

  // 5. CREATIVE DESIGN AND VIDEO EDITING
  {
    slug: 'creative-design-and-video-editing',
    categorySlug: 'design-media',
    title: 'Advanced Creative Design & Video Editing Program with AI',
    subTitle: 'Master Visual Design, Branding & Professional Video Editing',
    description:
      'Learn to create stunning digital creatives, edit high-performing videos, build complete brand assets, and confidently work on client projects.',
    format: 'Online & Offline Campuses',
    duration: '2 to 3 Months',
    level: 'Beginner to Professional',
    price: 0,
    status: CourseStatus.PUBLISHED,
    thumbnailUrl: '/uploads/courses/1789123754349-ai-powered-digital-marketing-course-card.webp',
    bannerUrl: '/uploads/courses/1789123324736-ai-powered-digital-marketing-banner.jpg.webp',
    brochureUrl: '/Courses/Creative Design and video editing course.pdf',
    learningOutcomes: [
      'Create stunning digital creatives using Photoshop and Illustrator',
      'Edit high-performing reels, commercials, and YouTube videos in Premiere Pro',
      'Build complete corporate visual identity and branding guidelines',
      'Animate typography and motion graphics with After Effects',
      'Use Generative AI design tools for rapid creative asset generation',
      'Establish a high-paying freelancing profile on Behance and Dribbble',
    ],
    targetAudience: ['Graphic Designers', 'Video Editors', 'Freelancers', 'Content Creators'],
    toolsCovered: ['Adobe Photoshop', 'Adobe Illustrator', 'Canva', 'Adobe Premiere Pro', 'Adobe After Effects', 'CapCut', 'Figma', 'AI Design Tools'],
    overviewJson: {
      batchInfo: 'New Batches Starting Soon | 16 Modules',
      location: 'Online & Offline Campuses',
      originalPrice: '—',
      discountedPrice: 'Contact Us',
      showCareerFeatures: true,
      usps: [
        'Live Interactive Classes',
        'Industry Expert Trainers',
        'Hands-on Real-Time Projects',
        'AI Tools & Industry Exposure',
        'Placement Guidance & Career Support',
        'Beginner-Friendly Curriculum',
      ],
      overviewDescription: [
        'Design and video editing are among the fastest growing creative digital skills globally. This program covers the full suite of creative tools from Photoshop and Illustrator to Premiere Pro and After Effects.',
        'You will build brand assets, master color harmony, motion graphics, and integrate generative AI tools like Midjourney to supercharge your design production.',
      ],
      overviewLearnings: [
        'Design Fundamentals & Color Theory',
        'Adobe Photoshop Creative Retouching & Compositing',
        'Adobe Illustrator Vector Graphics & Logo Systems',
        'Social Media Creative & Carousel Design',
        'Video Editing & Color Grading in Premiere Pro',
        'Motion Graphics & Keyframe Animation in After Effects',
      ],
      whoIsThisForData: [
        {
          role: 'Graphic Designers',
          title: 'Graphic Designers',
          iconName: 'PenTool',
          desc: 'Design high-quality digital assets for web and print.',
          description: 'Design high-quality digital assets for web and print.',
          points: ['Master Adobe tools', 'Create branding elements', 'Design viral social graphics'],
          bullets: ['Master Adobe tools', 'Create branding elements', 'Design viral social graphics'],
        },
        {
          role: 'Video Editors',
          title: 'Video Editors',
          iconName: 'Video',
          desc: 'Edit professional long-form and short-form video content.',
          description: 'Edit professional long-form and short-form video content.',
          points: ['Learn Premiere Pro', 'Create reels and ads', 'Motion graphics animation'],
          bullets: ['Learn Premiere Pro', 'Create reels and ads', 'Motion graphics animation'],
        },
      ],
      categorizedToolsData: [
        {
          category: 'Creative Design Tools',
          description: 'Industry-standard vector and raster design software.',
          tools: [
            { name: 'Canva', iconUrl: '/tools/canva.svg' },
            { name: 'Midjourney', iconUrl: '/tools/midjourney.svg' },
          ],
        },
      ],
    },
    designedToHelpJson: {
      title: 'Designed to Launch Your Creative Career',
      description: 'Master visual design, brand storytelling, and video production with AI tools.',
      benefits: [
        { iconName: 'Blocks', title: 'Complete Brand Identity', description: 'Design logos, color systems, and typography palettes for global brands.' },
        { iconName: 'Sparkles', title: 'Cinematic Video Editing', description: 'Cut, transition, and color-grade high-impact commercials and reels.' },
        { iconName: 'Rocket', title: 'AI Accelerated Workflows', description: 'Generate concepts, upscale assets, and automate captions with AI.' },
      ],
    },
    numberedFeaturesJson: {
      title: 'What You Will Master',
      description: 'A comprehensive creative curriculum covering raster, vector, and timeline editing.',
      features: [
        { num: '01', iconName: 'FileImage', title: 'Vector & Raster Mastery', description: 'Precision vector drawing and photo manipulation.' },
        { num: '02', iconName: 'PlayCircle', title: 'Video Storytelling', description: 'Pacing, sound design, and color grading for YouTube and social media.' },
        { num: '03', iconName: 'Sparkles', title: 'Generative AI Workflows', description: 'AI voiceovers, automated subtitling, and AI image synthesis.' },
      ],
    },
    whyDigitalGhuruJson: {
      title: 'Why Creative Media with Digital Guru?',
      reasons: [
        { num: '01', iconName: 'PenTool', title: 'Showreel Creation', description: 'Build an impressive visual portfolio on Behance and Dribbble.' },
        { num: '02', iconName: 'DollarSign', title: 'Client Acquisition', description: 'Learn how to pitch, price, and land freelance clients internationally.' },
      ],
    },
    topHighlightsJson: [
      { iconName: 'Award', title: 'Professional Creative Certification', description: 'Recognized proof of design and video competence.' },
      { iconName: 'FolderKanban', title: 'Complete Client Portfolio', description: 'Graduate with 10+ real-world creative project case studies.' },
    ],
    faqsJson: [
      { question: 'Is this suitable for beginners?', answer: 'Yes, we start from design fundamentals and basic tool operations.' },
      { question: 'What software will I need?', answer: 'Adobe Photoshop, Illustrator, Premiere Pro, and Canva.' },
    ],
    curriculum: [
      { title: 'Module 1: Design Fundamentals', topics: ['Principles of Design', 'Color Theory', 'Typography Basics', 'Layout & Composition'] },
      { title: 'Module 2: Adobe Photoshop Fundamentals', topics: ['Interface & Tools', 'Selection Techniques', 'Image Retouching', 'Poster Design'] },
      { title: 'Module 3: Adobe Illustrator Vector Design', topics: ['Pen Tool Mastery', 'Vector Shapes', 'Logo Creation', 'Icon Design'] },
      { title: 'Module 4: Branding & Visual Identity', topics: ['Brand Guidelines', 'Logo Systems', 'Color Palettes', 'Stationery Design'] },
      { title: 'Module 5: Social Media Creative Design', topics: ['Instagram Carousels', 'Ad Creatives', 'Story Designs', 'Cover Graphics'] },
      { title: 'Module 6: Video Editing Fundamentals', topics: ['Cuts & Transitions', 'Storytelling', 'Audio Syncing', 'Color Grading Basics'] },
      { title: 'Module 7: Advanced Video Editing', topics: ['Cinematic Workflows', 'Special Effects', 'Multicam Editing', 'Export Settings'] },
      { title: 'Module 8: Motion Graphics & Animation', topics: ['Keyframing', 'Text Animation', 'Visual Effects', 'Tracking'] },
      { title: 'Module 9: AI-Powered Creative Workflows', topics: ['AI Design Tools', 'AI Video Editing', 'Automated Subtitles', 'Workflow Optimization'] },
      { title: 'Module 10: Portfolio & Freelancing', topics: ['Showreel Creation', 'Behance Setup', 'Client Pricing', 'Contracts & Delivery'] },
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
  const permitFranchiseId = options?.permitFranchiseId || parsed.permitFranchiseId;

  let baseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (process.env.TEST_DATABASE_URL) {
    assertSafeTestDatabase();
    baseUrl = process.env.TEST_DATABASE_URL;
  }
  if (!baseUrl) {
    throw new Error('DATABASE_URL or TEST_DATABASE_URL is missing in environment');
  }

  console.log(`\n=== Digital Guru Complete Source Catalogue Importer ===`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'EXECUTE'} | Target Schema: ${schema}`);
  console.log(`Authentic Source Catalogue Count: ${SOURCE_COURSES.length} courses across ${SOURCE_CATEGORIES.length} categories\n`);

  const prisma = new PrismaClient({
    datasources: { db: { url: withSchemaUrl(baseUrl, schema) } },
  });

  const summary = {
    categoriesCreated: 0,
    categoriesSkipped: 0,
    coursesCreated: 0,
    coursesSkipped: 0,
    aliasesCreated: 0,
    modulesCreated: 0,
    chaptersCreated: 0,
  };

  try {
    const categoryIdBySlug = new Map<string, string>();

    // 1. Import Categories
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

    // 2. Import Courses
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
        // Ensure aliases are present even if course was previously created
        if (!dryRun && course.slugAliases && course.slugAliases.length > 0 && existingBySlug) {
          for (const aliasSlug of course.slugAliases) {
            const aliasExists = await prisma.courseSlugAlias.findUnique({ where: { slug: aliasSlug } });
            if (!aliasExists) {
              await prisma.courseSlugAlias.create({
                data: { courseId: existingBySlug.id, slug: aliasSlug },
              });
              summary.aliasesCreated++;
              console.log(`  [Alias] ADDED: ${aliasSlug} -> ${existingBySlug.slug}`);
            }
          }
        }
        continue;
      }

      const modCount = course.curriculum.length;
      const chapCount = course.curriculum.reduce((sum, m) => sum + m.topics.length, 0);

      if (dryRun) {
        summary.coursesCreated++;
        summary.modulesCreated += modCount;
        summary.chaptersCreated += chapCount;
        if (course.slugAliases) {
          summary.aliasesCreated += course.slugAliases.length;
        }
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

        // Insert Slug Aliases
        if (course.slugAliases && course.slugAliases.length > 0) {
          for (const aliasSlug of course.slugAliases) {
            await tx.courseSlugAlias.create({
              data: {
                courseId: createdCourse.id,
                slug: aliasSlug,
              },
            });
            summary.aliasesCreated++;
            console.log(`  [Alias] CREATED: ${aliasSlug} -> ${createdCourse.slug}`);
          }
        }

        // Version 1 Curriculum
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
                    duration: '10:00', // Authentic default from digitalghuru_updated
                    isFree: mIdx === 0 && cIdx === 0,
                    ...(mIdx === 0 && cIdx === 0 && course.brochureUrl
                      ? {
                          attachments: {
                            create: [
                              {
                                title: `${course.title} Syllabus & Brochure`,
                                fileUrl: course.brochureUrl,
                                fileType: 'PDF' as const,
                                fileSize: 1024,
                                isDownload: true,
                              },
                            ],
                          },
                        }
                      : {}),
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
      }, { maxWait: 25000, timeout: 90000 });

      summary.coursesCreated++;
      summary.modulesCreated += modCount;
      summary.chaptersCreated += chapCount;
      console.log(
        `[Course] CREATED: ${course.title} (${course.slug}) | ${modCount} modules | ${chapCount} lessons`
      );
    }

    console.log('\n=== Import Summary ===');
    console.log(JSON.stringify({ dryRun, schema, ...summary }, null, 2));
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
