import 'dotenv/config';
import { PrismaClient, CourseStatus } from '@prisma/client';

const prisma = new PrismaClient();

const KIDS_CATEGORY = {
  name: 'AI Super Kids (School Programs)',
  slug: 'ai-super-kids',
  description: 'A structured school partnership and weekend technology program for young learners from Grades 1 to 12. Develops real AI capability, data literacy, coding, and responsible innovation.',
  icon: 'Sparkles',
  sortOrder: 3,
};

const KIDS_COURSES = [
  {
    slug: 'ai-super-kids-grades-1-6',
    title: 'AI Super Kids - Grades 1 to 6',
    subTitle: 'Foundations of AI & Creative Exploration',
    description: 'An interactive technology foundation for primary students. Introduces computational thinking, safe digital exploration, visual logic, and creative problem-solving using kid-friendly AI tools.',
    format: 'Classroom + Interactive Lab',
    duration: '3 to 6 Months',
    level: 'Primary (Grades 1–6)',
    price: 14999,
    status: CourseStatus.PUBLISHED,
    thumbnailUrl: '/brand/card-g1-6.png',
    bannerUrl: '/brand/banner-g1-6.png',
    brochureUrl: '/Courses/19-09-2026 AI Super kids Grade 7 to 8 Brochure.pdf',
    learningOutcomes: [
      'Understand how computers and smart devices learn from examples',
      'Develop visual logic and pattern recognition skills',
      'Explore creative storytelling and digital art with guided AI tools',
      'Practice digital safety, screen-time balance, and responsible internet use',
      'Build beginner science and story projects with interactive guidance',
    ],
    targetAudience: ['Primary Students (Grades 1–6)', 'Young Innovators', 'Curious Learners'],
    toolsCovered: ['Scratch AI', 'Kid-Safe Creative Prompts', 'Visual Logic Blocks', 'Canva for Kids'],
    curriculum: [
      {
        title: 'Module 1: Welcome to the World of AI',
        topics: ['What is intelligence? Human vs Machine', 'Everyday smart tools: voice assistants, cameras, maps', 'Safe internet habits and digital boundaries'],
      },
      {
        title: 'Module 2: Patterns & Logic',
        topics: ['How computers spot patterns in pictures and sounds', 'Sorting, classifying, and logic games', 'Hands-on pattern recognition activities'],
      },
      {
        title: 'Module 3: Creative AI Fun',
        topics: ['Story generation and comic strip creation', 'Digital drawing and creative canvas tools', 'Presenting my first digital project to classmates'],
      },
    ],
  },
  {
    slug: 'ai-super-kids-grades-7-8',
    title: 'AI Super Kids - Grades 7 to 8 (AI Innovators)',
    subTitle: 'Solve Problems with AI',
    description: 'A structured program for middle school students focusing on data literacy, understanding machine learning patterns, responsible research, and practical AI solution design.',
    format: 'Classroom + Interactive Lab',
    duration: '3 to 6 Months',
    level: 'Middle School (Grades 7–8)',
    price: 19999,
    status: CourseStatus.PUBLISHED,
    thumbnailUrl: '/brand/card-g7-8.png',
    bannerUrl: '/brand/banner-g7-8.png',
    brochureUrl: '/Courses/19-09-2026 AI Super kids Grade 7 to 8 Brochure.pdf',
    learningOutcomes: [
      'Understand machine learning from patterns and data classifications',
      'Data literacy, data quality, and bias awareness in algorithms',
      'Advanced prompt craft & AI-assisted academic research',
      'Automation workflows & design thinking frameworks',
      'Build real-world prototypes & study tool solutions',
    ],
    targetAudience: ['Middle School Students (Grades 7–8)', 'Aspiring Coders', 'Science & Innovation Enthusiasts'],
    toolsCovered: ['Machine Learning for Kids', 'Prompt Engineering Tools', 'Google Teachable Machine', 'Canva Pro'],
    curriculum: [
      {
        title: 'Module 1: Machine Learning & Data Literacy',
        topics: ['How models train: inputs, patterns, labels, and outputs', 'Data quality, noise, and bias awareness in AI', 'Training image and audio classifiers with Teachable Machine'],
      },
      {
        title: 'Module 2: Advanced Prompting & Research Craft',
        topics: ['Structuring multi-step prompts for research and study', 'Fact-checking, hallucination spotting, and source verification', 'Creating interactive study flashcards and revision bots'],
      },
      {
        title: 'Module 3: Design Thinking & Prototyping',
        topics: ['Identifying school and community pain points', 'Designing the AI Study Assistant prototype', 'Testing and presenting the final innovation project'],
      },
    ],
  },
  {
    slug: 'ai-super-kids-grades-9-10',
    title: 'AI Super Kids - Grades 9 to 10 (AI Entrepreneurs)',
    subTitle: 'Build with AI & Startup Innovation',
    description: 'Turn real-world problems into responsible AI products, services, and startup concepts. High school students explore Generative AI, Computer Vision, and NLP while mastering the startup lifecycle.',
    format: 'Classroom + Interactive Lab',
    duration: '3 to 6 Months',
    level: 'High School (Grades 9–10)',
    price: 24999,
    status: CourseStatus.PUBLISHED,
    thumbnailUrl: '/brand/card-g9-10.png',
    bannerUrl: '/brand/banner-g9-10.png',
    brochureUrl: '/Courses/19-09-2026 AI Super Kids Grade 9 to 10 Brochure.pdf',
    learningOutcomes: [
      'Understand Large Language Models, NLP, and Computer Vision',
      'Advanced prompt engineering with constraints and system roles',
      'User research, market opportunity sizing, and competitive analysis',
      'Interactive prototyping and customer feedback loops',
      'Final Project: Build, brand, and pitch an AI Startup concept',
    ],
    targetAudience: ['High School Students (Grades 9–10)', 'Future Tech Entrepreneurs', 'Young Product Designers'],
    toolsCovered: ['OpenAI Playground', 'Figma AI', 'Voiceflow / Chatbot Builders', 'Zapier Automation'],
    curriculum: [
      {
        title: 'Module 1: Generative AI, NLP & Computer Vision',
        topics: ['Architecture of LLMs and how generative models work', 'Computer vision and multi-modal sensory inputs', 'System prompts, role framing, and constraint tuning'],
      },
      {
        title: 'Module 2: Product Strategy & User Research',
        topics: ['Discovering user pain points in education, health, and local business', 'Wireframing user journeys and automated conversational flows', 'Building an interactive AI chatbot prototype with Voiceflow'],
      },
      {
        title: 'Module 3: Startup Pitch & Launch',
        topics: ['Business models, unit economics, and value propositions', 'Creating pitch decks and demo videos', 'Pitching the AI Startup project to mentors and peers'],
      },
    ],
  },
  {
    slug: 'ai-super-kids-grades-11-12',
    title: 'AI Super Kids - Grades 11 to 12 (AI Future Leaders)',
    subTitle: 'Build Your AI Future & Career Pathways',
    description: 'Advanced technical foundation for higher education, AI careers, and technology leadership. Students learn Python programming, data handling, machine learning algorithms, APIs, and build a verified college portfolio.',
    format: 'Classroom + AI Lab',
    duration: '4 to 6 Months',
    level: 'Senior Secondary (Grades 11–12)',
    price: 29999,
    status: CourseStatus.PUBLISHED,
    thumbnailUrl: '/brand/card-g11-12.png',
    bannerUrl: '/brand/banner-g11-12.png',
    brochureUrl: '/Courses/19-09-2026 AI Super kids Grade 11 to 12 Brochure.pdf',
    learningOutcomes: [
      'Write clean Python code for data analysis and algorithmic logic',
      'Data visualization, cleaning, and model evaluation techniques',
      'Connect REST APIs and orchestrate intelligent automation workflows',
      'Introduction to autonomous AI agents, memory, and multi-step execution',
      'Graduate with a verified GitHub portfolio, LinkedIn profile, and AI Capstone',
    ],
    targetAudience: ['Senior School Students (Grades 11–12)', 'Future Computer Science / Engineering Undergrads', 'Tech Leaders'],
    toolsCovered: ['Python 3', 'Jupyter Notebooks', 'Pandas & Matplotlib', 'Hugging Face & OpenAI APIs', 'GitHub'],
    curriculum: [
      {
        title: 'Module 1: Python for Data & AI',
        topics: ['Python data structures, loops, and functional logic', 'Data handling with Pandas and visualization with Matplotlib', 'Exploratory data analysis on real datasets'],
      },
      {
        title: 'Module 2: Machine Learning Models & APIs',
        topics: ['Supervised vs Unsupervised learning algorithms', 'Connecting cloud AI APIs with Python requests', 'Building intelligent multi-step prediction scripts'],
      },
      {
        title: 'Module 3: AI Agents, Capstone & Career Portfolio',
        topics: ['Introduction to AI agent architectures and reasoning loops', 'End-to-end AI Capstone Project development', 'GitHub portfolio setup, documentation, and college showcase'],
      },
    ],
  },
];

async function main() {
  console.log('🚀 Starting AI Super Kids Course Integration...');

  // 1. Create or ensure category
  const category = await prisma.courseCategory.upsert({
    where: { slug: KIDS_CATEGORY.slug },
    create: KIDS_CATEGORY,
    update: {
      name: KIDS_CATEGORY.name,
      description: KIDS_CATEGORY.description,
      icon: KIDS_CATEGORY.icon,
      sortOrder: KIDS_CATEGORY.sortOrder,
    },
  });
  console.log(`✓ Category ready: ${category.name} (${category.id})`);

  // 2. Fetch all active franchises
  const franchises = await prisma.franchise.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, code: true },
  });
  console.log(`✓ Found ${franchises.length} active franchise(s) to grant course permissions`);

  // 3. Upsert each course
  for (const courseData of KIDS_COURSES) {
    const { curriculum, ...courseFields } = courseData;

    let course = await prisma.globalCourse.findUnique({
      where: { slug: courseFields.slug },
      include: { activeCurriculumVersion: true },
    });

    if (!course) {
      course = await prisma.globalCourse.create({
        data: {
          ...courseFields,
          categoryId: category.id,
        },
        include: { activeCurriculumVersion: true },
      });
      console.log(`✓ Created Course: ${course.title} (${course.id})`);
    } else {
      course = await prisma.globalCourse.update({
        where: { id: course.id },
        data: {
          ...courseFields,
          categoryId: category.id,
        },
        include: { activeCurriculumVersion: true },
      });
      console.log(`✓ Updated Course: ${course.title} (${course.id})`);
    }

    // Curriculum Version check
    if (!course.activeCurriculumVersion) {
      const activeVersion = await prisma.courseCurriculumVersion.create({
        data: {
          courseId: course.id,
          version: 1,
          title: 'Version 1.0 (Official Curriculum)',
          isPublished: false,
          isLocked: false,
          modules: {
            create: curriculum.map((mod, mIdx) => ({
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

      await prisma.courseCurriculumVersion.update({
        where: { id: activeVersion.id },
        data: { isPublished: true, isLocked: true },
      });

      await prisma.globalCourse.update({
        where: { id: course.id },
        data: { activeCurriculumVersionId: activeVersion.id },
      });
      console.log(`  ✓ Created & Published Curriculum Version with ${curriculum.length} modules`);
    }

    // 4. Grant permissions to all active franchises
    for (const franchise of franchises) {
      await prisma.franchiseCourseSelection.upsert({
        where: {
          franchiseId_courseId: {
            franchiseId: franchise.id,
            courseId: course.id,
          },
        },
        create: {
          franchiseId: franchise.id,
          courseId: course.id,
          isPermitted: true,
          isEnabled: true,
        },
        update: {
          isPermitted: true,
        },
      });
    }
    console.log(`  ✓ Granted permissions to ${franchises.length} franchise(s)`);
  }

  console.log('\n🎉 ALL 4 AI SUPER KIDS COURSES SUCCESSFULLY INTEGRATED!');
}

main()
  .catch((e) => {
    console.error('Error importing kids courses:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
