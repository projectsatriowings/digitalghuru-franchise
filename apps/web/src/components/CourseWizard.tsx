import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Save,
  Loader2,
  CheckCircle,
  Laptop2,
  Users,
  FileText,
  Layers,
  Video,
  PlayCircle,
  Link as LinkIcon,
  BookOpen,
  Upload,
  Image as ImageIcon,
  X,
  Sparkles,
  Lock,
  ArrowUp,
  ArrowDown,
  Paperclip,
  Sliders,
  GitBranch,
} from 'lucide-react';
import { IconPickerDropdown } from './IconPickerDropdown';
import { useToast } from '../context/ToastContext';
import { getAuthToken } from '../services/api';

interface CourseCategory {
  id: string;
  name: string;
  slug: string;
}

interface CourseWizardProps {
  initialData?: any;
  categories?: CourseCategory[];
  onComplete: (data: any) => void;
  onCancel?: () => void;
  onCreateDraftVersion?: (courseId: string) => Promise<void> | void;
  creatingDraftVersion?: boolean;
  isSaving?: boolean;
  isEditMode?: boolean;
}

const STEPS = [
  'Basic Details',
  'Course Overview',
  'Designed To Help',
  'Numbered Features',
  'Why Digital Ghuru',
  'Target Audience',
  'Top Highlights',
  'Tools Mastered',
  'Modules & Lessons',
  'FAQs',
  'Extensible Features',
];

const QUICK_ADD_TOOLS = [
  'ChatGPT',
  'Midjourney',
  'Canva',
  'Google Ads',
  'Meta Ads',
  'WordPress',
  'Zapier',
  'Google Analytics',
  'SEMrush',
  'Mailchimp',
  'Hootsuite',
  'Claude',
  'React',
  'Node.js',
  'Express',
  'MongoDB',
  'Tailwind CSS',
  'GitHub',
  'Postman',
  'VS Code',
];

const DEFAULT_TOOL_ICONS: Record<string, string> = {
  ChatGPT: '/tools/openai.svg',
  OpenAI: '/tools/openai.svg',
  Midjourney: '/tools/midjourney.svg',
  Canva: '/tools/canva.svg',
  WordPress: '/tools/wordpress.svg',
  'Google Ads': '/tools/googleads.svg',
  'Meta Ads': '/tools/meta.svg',
  Meta: '/tools/meta.svg',
  Zapier: '/tools/zapier.svg',
  'Google Analytics': '/tools/googleanalytics.svg',
  SEMrush: '/tools/semrush.svg',
  Mailchimp: '/tools/mailchimp.svg',
  Hootsuite: '/tools/hootsuite.svg',
  Anthropic: '/tools/anthropic.svg',
  Claude: '/tools/anthropic.svg',
  React: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/react/react-original.svg',
  'Node.js': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/nodejs/nodejs-original.svg',
  Express: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/express/express-original.svg',
  MongoDB: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/mongodb/mongodb-original.svg',
  HTML5: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/html5/html5-original.svg',
  CSS3: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/css3/css3-original.svg',
  JavaScript: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg',
  Git: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/git/git-original.svg',
  GitHub: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/github/github-original.svg',
  Postman: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/postman/postman-original.svg',
  'VS Code': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/vscode/vscode-original.svg',
  'Tailwind CSS': 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/tailwindcss/tailwindcss-original.svg',
  Redux: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/redux/redux-original.svg',
};

function getToolIcon(name: string): string {
  if (!name) return '/tools/openai.svg';
  const trimmed = name.trim();
  if (DEFAULT_TOOL_ICONS[trimmed]) return DEFAULT_TOOL_ICONS[trimmed];
  for (const [key, val] of Object.entries(DEFAULT_TOOL_ICONS)) {
    if (key.toLowerCase() === trimmed.toLowerCase()) return val;
  }
  return '/tools/openai.svg';
}

const DEFAULT_EXTENSIBLE_CONFIG = {
  schemaVersion: 1,
  featureFlags: {
    showCareerFeatures: true,
    certificatesEnabled: true,
    xpEnabled: true,
    lessonXp: 10,
    completionXp: 100,
    allowFreePreview: true,
    quizzesEnabled: false,
    assignmentsEnabled: false,
    discussionsEnabled: false,
    liveSessionsEnabled: false,
  },
  customAttributes: [] as Array<{ key: string; label: string; value: string; type: string }>,
  customSections: [] as Array<any>,
};

function normalizeAudienceItem(aud: any) {
  if (typeof aud === 'string') {
    return { title: aud, role: aud, iconName: 'Users', description: '', desc: '', bullets: [], points: [] };
  }
  const title = aud?.title || aud?.role || '';
  const description = aud?.description || aud?.desc || '';
  const bullets = Array.isArray(aud?.bullets) && aud.bullets.length > 0
    ? aud.bullets
    : (Array.isArray(aud?.points) ? aud.points : []);
  return {
    ...aud,
    title,
    role: title,
    description,
    desc: description,
    bullets,
    points: bullets,
  };
}

function normalizeAttachmentItem(att: any) {
  const fileType = att?.fileType || att?.type || 'PDF';
  const isDownload =
    att?.isDownload !== undefined
      ? Boolean(att.isDownload)
      : (att?.isDownloadable !== undefined ? Boolean(att.isDownloadable) : true);
  return {
    id: att?.id,
    title: att?.title || 'Resource',
    fileUrl: att?.fileUrl || '',
    fileType,
    fileSize: Number(att?.fileSize) || 0,
    isDownload,
  };
}

function normalizeWizardData(initialData?: any) {
  if (!initialData) {
    const starterTools = [
      { name: 'ChatGPT', iconUrl: '/tools/openai.svg' },
      { name: 'Canva', iconUrl: '/tools/canva.svg' },
      { name: 'Google Ads', iconUrl: '/tools/googleads.svg' },
      { name: 'Meta Ads', iconUrl: '/tools/meta.svg' },
    ];
    return {
      title: '',
      slug: '',
      categoryId: '',
      level: 'Beginner to Advanced',
      subtitle: '',
      description: '',
      duration: '',
      format: 'Online / Classroom',
      originalPrice: '',
      discountedPrice: '',
      batchInfo: '',
      location: '',
      cardImage: '',
      bannerImage: '',
      brochureUrl: '',
      isPublished: false,
      isCurriculumLocked: false,
      extensibleConfig:
        typeof structuredClone === 'function'
          ? structuredClone(DEFAULT_EXTENSIBLE_CONFIG)
          : JSON.parse(JSON.stringify(DEFAULT_EXTENSIBLE_CONFIG)),
      marketing_data: {
        showCareerFeatures: true,
        highlightsData: [],
        designedToHelp: { title: 'This course is designed to help you', description: '', benefits: [] },
        numberedFeatures: { title: '', description: '', features: [] },
        whyDigitalGhuru: { title: '', reasons: [] },
        whoIsThisForData: [],
        categorizedToolsData: [
          {
            category: 'Core Tools & Technologies',
            title: 'Core Tools & Technologies',
            description: 'Master essential industry tools and platforms.',
            bgClass: 'bg-white',
            textClass: 'text-[#0d2f62]',
            tools: starterTools,
            items: starterTools,
          },
        ],
        tools: ['ChatGPT', 'Canva', 'Google Ads', 'Meta Ads'],
        faqs: [],
        overviewDescription: [],
        overviewLearnings: [],
      },
      modules: [
        {
          title: 'Module 1: Foundation & Core Strategy',
          description: '',
          lessons: [
            { title: 'Introduction & Digital Ecosystem Overview', description: '', videoUrl: '', pdfUrl: '', duration: '15:00', isFree: true, attachments: [] },
            { title: 'Core Frameworks & Best Practices', description: '', videoUrl: '', pdfUrl: '', duration: '20:00', isFree: false, attachments: [] },
          ],
        },
        {
          title: 'Module 2: Practical Implementation',
          description: '',
          lessons: [
            { title: 'Setup & Walkthrough of Essential Tools', description: '', videoUrl: '', pdfUrl: '', duration: '25:00', isFree: false, attachments: [] },
            { title: 'Hands-on Capstone Project Exercise', description: '', videoUrl: '', pdfUrl: '', duration: '30:00', isFree: false, attachments: [] },
          ],
        },
      ],
    };
  }

  // Merge both target GlobalCourse schema JSONB columns and legacy marketing_data
  const overviewObj = initialData.overviewJson || {};
  const mData = initialData.marketing_data || {};

  const rawOverviewDesc =
    overviewObj.overviewDescription || mData.overviewDescription || initialData.overviewDescription || [];
  const cleanOverviewDesc = Array.isArray(rawOverviewDesc)
    ? rawOverviewDesc.map((item: any) => (typeof item === 'string' ? item : String(item || '')))
    : [];

  const rawLearnings =
    overviewObj.overviewLearnings || mData.overviewLearnings || initialData.learningOutcomes || [];
  const cleanLearnings = Array.isArray(rawLearnings)
    ? rawLearnings.map((item: any) => (typeof item === 'string' ? item : String(item || '')))
    : [];

  // Resolve editable draft curriculum version first, fallback to activeCurriculumVersion
  const versions = Array.isArray(initialData.curriculumVersions) ? initialData.curriculumVersions : [];
  const draftVersion = versions.find((v: any) => !v.isLocked && !v.isPublished);
  const targetVersion = draftVersion || initialData.activeCurriculumVersion;
  const isCurriculumLocked = Boolean(
    targetVersion && (targetVersion.isLocked || targetVersion.isPublished) && !draftVersion
  );

  let initialModulesList: any[] = [];
  if (targetVersion && Array.isArray(targetVersion.modules) && targetVersion.modules.length > 0) {
    initialModulesList = targetVersion.modules.map((mod: any, i: number) => ({
      id: mod.id,
      title: mod.title || `Module ${i + 1}`,
      description: mod.description || '',
      lessons: (mod.chapters || []).map((ch: any) => ({
        id: ch.id,
        title: ch.title || '',
        description: ch.description || '',
        videoUrl: ch.videoUrl || '',
        pdfUrl: ch.pdfUrl || '',
        duration: ch.duration || '10:00',
        isFree: Boolean(ch.isFree),
        attachments: Array.isArray(ch.attachments) ? ch.attachments.map(normalizeAttachmentItem) : [],
      })),
    }));
  } else if (Array.isArray(initialData.modules) && initialData.modules.length > 0) {
    initialModulesList = initialData.modules.map((mod: any, i: number) => ({
      id: mod.id,
      title: mod.title || `Module ${i + 1}`,
      description: mod.description || '',
      lessons: (mod.chapters || mod.lessons || []).map((ch: any) => ({
        id: ch.id,
        title: ch.title || '',
        description: ch.description || '',
        videoUrl: ch.videoUrl || '',
        pdfUrl: ch.pdfUrl || '',
        duration: ch.duration || '10:00',
        isFree: Boolean(ch.isFree),
        attachments: Array.isArray(ch.attachments) ? ch.attachments.map(normalizeAttachmentItem) : [],
      })),
    }));
  }

  // Reconstruct categorized tools
  const rawCategorizedTools =
    overviewObj.categorizedToolsData || mData.categorizedToolsData || [];
  let normalizedCategorizedTools: any[] = [];
  if (Array.isArray(rawCategorizedTools) && rawCategorizedTools.length > 0) {
    normalizedCategorizedTools = rawCategorizedTools.map((group: any) => {
      const catTitle = group.category || group.title || 'Tools';
      const rawTools = group.tools || group.items || [];
      const cleanTools = rawTools.map((t: any) => {
        const tName = typeof t === 'string' ? t : t?.name || '';
        const tIcon = typeof t === 'object' && t?.iconUrl ? t.iconUrl : getToolIcon(tName);
        return { name: tName, iconUrl: tIcon };
      });
      return {
        category: catTitle,
        title: catTitle,
        description: group.description || '',
        bgClass: group.bgClass || 'bg-white',
        textClass: group.textClass || 'text-[#0d2f62]',
        tools: cleanTools,
        items: cleanTools,
      };
    });
  } else if (Array.isArray(initialData.toolsCovered) && initialData.toolsCovered.length > 0) {
    const cleanTools = initialData.toolsCovered.map((t: string) => ({
      name: t,
      iconUrl: getToolIcon(t),
    }));
    normalizedCategorizedTools = [
      {
        category: 'Core Tools & Platforms',
        title: 'Core Tools & Platforms',
        description: 'Essential software & platforms covered in this course.',
        bgClass: 'bg-white',
        textClass: 'text-[#0d2f62]',
        tools: cleanTools,
        items: cleanTools,
      },
    ];
  }

  // Reconstruct target audience cards (supports both title/bullets and role/points)
  const rawWhoIsThisFor =
    overviewObj.whoIsThisForData ||
    mData.whoIsThisForData ||
    (Array.isArray(initialData.targetAudience) ? initialData.targetAudience : []);
  const normalizedWhoIsThisFor = Array.isArray(rawWhoIsThisFor)
    ? rawWhoIsThisFor.map(normalizeAudienceItem)
    : [];

  const showCareerFeatures =
    overviewObj.showCareerFeatures !== undefined
      ? overviewObj.showCareerFeatures
      : mData.showCareerFeatures !== undefined
      ? mData.showCareerFeatures
      : true;

  const existingExt = overviewObj.extensibleConfig || initialData.extensibleConfig || {};
  const extensibleConfig = {
    schemaVersion: existingExt.schemaVersion || 1,
    featureFlags: {
      ...DEFAULT_EXTENSIBLE_CONFIG.featureFlags,
      showCareerFeatures,
      ...(existingExt.featureFlags || {}),
    },
    customAttributes: Array.isArray(existingExt.customAttributes) ? existingExt.customAttributes : [],
    customSections: Array.isArray(existingExt.customSections) ? existingExt.customSections : [],
  };

  const rawDesignedToHelp = initialData.designedToHelpJson || mData.designedToHelp || {};
  const rawNumberedFeatures = initialData.numberedFeaturesJson || mData.numberedFeatures || {};
  const rawWhyDigitalGhuru = initialData.whyDigitalGhuruJson || mData.whyDigitalGhuru || {};

  return {
    id: initialData.id,
    title: initialData.title || '',
    slug: initialData.slug || '',
    categoryId: initialData.categoryId || '',
    level: initialData.level || 'Beginner to Advanced',
    subtitle: initialData.subTitle || initialData.subtitle || '',
    description: initialData.description || '',
    duration: initialData.duration || '',
    format: initialData.format || 'Online / Classroom',
    originalPrice: String(
      overviewObj.originalPrice ?? initialData.originalPrice ?? initialData.price ?? ''
    ),
    discountedPrice: String(
      overviewObj.discountedPrice ?? initialData.discountedPrice ?? initialData.price ?? ''
    ),
    batchInfo: overviewObj.batchInfo || initialData.batchInfo || '',
    location: overviewObj.location || initialData.location || '',
    cardImage: initialData.thumbnailUrl || initialData.cardImage || mData.cardImage || '',
    bannerImage: initialData.bannerUrl || initialData.bannerImage || mData.bannerImage || '',
    brochureUrl: initialData.brochureUrl || '',
    isPublished: initialData.status === 'PUBLISHED' || Boolean(initialData.isPublished),
    isCurriculumLocked,
    activeDraftVersionId: draftVersion?.id || null,
    extensibleConfig,
    marketing_data: {
      showCareerFeatures,
      usps: overviewObj.usps || mData.usps || [],
      highlightsData: initialData.topHighlightsJson || mData.highlightsData || [],
      designedToHelp: {
        title: rawDesignedToHelp.title ?? 'This course is designed to help you',
        description: rawDesignedToHelp.description ?? '',
        benefits: Array.isArray(rawDesignedToHelp.benefits) ? rawDesignedToHelp.benefits : [],
      },
      numberedFeatures: {
        title: rawNumberedFeatures.title ?? '',
        description: rawNumberedFeatures.description ?? '',
        features: Array.isArray(rawNumberedFeatures.features) ? rawNumberedFeatures.features : [],
      },
      whyDigitalGhuru: {
        title: rawWhyDigitalGhuru.title ?? '',
        reasons: Array.isArray(rawWhyDigitalGhuru.reasons) ? rawWhyDigitalGhuru.reasons : [],
      },
      whoIsThisForData: normalizedWhoIsThisFor,
      categorizedToolsData: normalizedCategorizedTools,
      tools: initialData.toolsCovered || mData.tools || [],
      faqs: initialData.faqsJson || mData.faqs || [],
      overviewDescription: cleanOverviewDesc,
      overviewLearnings: cleanLearnings,
    },
    modules: initialModulesList,
  };
}

export const CourseWizard: React.FC<CourseWizardProps> = ({
  initialData,
  categories = [],
  onComplete,
  onCancel,
  onCreateDraftVersion,
  creatingDraftVersion = false,
  isSaving = false,
  isEditMode = false,
}) => {
  const toast = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<any>(() => normalizeWizardData(initialData));

  useEffect(() => {
    setData(normalizeWizardData(initialData));
  }, [initialData]);

  const cardFileInputRef = useRef<HTMLInputElement>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const brochureFileInputRef = useRef<HTMLInputElement>(null);

  const [uploadingCard, setUploadingCard] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingBrochure, setUploadingBrochure] = useState(false);
  const [uploadingAttachmentKey, setUploadingAttachmentKey] = useState<string | null>(null);

  const uploadToCourseMedia = async (file: File, folder: string) => {
    const formData = new FormData();
    formData.append('folder', folder);
    formData.append('file', file);

    const token = getAuthToken();
    const rawBase = (import.meta.env.VITE_API_URL || '/api').trim();
    const apiBase = rawBase.endsWith('/api') ? rawBase : `${rawBase.replace(/\/$/, '')}/api`;

    const res = await fetch(`${apiBase}/courses/upload?folder=${encodeURIComponent(folder)}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const result = await res.json();
    if (!res.ok || !result.success || !result.data?.fileUrl) {
      throw new Error(result.message || 'Upload failed');
    }
    return result.data;
  };

  const handleFileUpload = async (file: File, type: 'card' | 'banner' | 'brochure') => {
    const setLoading =
      type === 'card'
        ? setUploadingCard
        : type === 'banner'
        ? setUploadingBanner
        : setUploadingBrochure;

    const folder = type === 'card' ? 'thumbnails' : type === 'banner' ? 'banners' : 'brochures';
    setLoading(true);
    try {
      const uploaded = await uploadToCourseMedia(file, folder);
      if (type === 'card') {
        setData((prev: any) => ({ ...prev, cardImage: uploaded.fileUrl }));
        toast.success('Course card image uploaded');
      } else if (type === 'banner') {
        setData((prev: any) => ({ ...prev, bannerImage: uploaded.fileUrl }));
        toast.success('Course banner image uploaded');
      } else {
        setData((prev: any) => ({ ...prev, brochureUrl: uploaded.fileUrl }));
        toast.success('Brochure PDF uploaded');
      }
    } catch (err: any) {
      toast.error(err.message || 'File upload failed');
    } finally {
      setLoading(false);
    }
  };

  const inferAttachmentType = (mimeType: string, filename: string): 'PDF' | 'ZIP' | 'DOCUMENT' | 'IMAGE' => {
    const lower = filename.toLowerCase();
    if (mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/.test(lower)) return 'IMAGE';
    if (mimeType.includes('zip') || lower.endsWith('.zip')) return 'ZIP';
    if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) return 'PDF';
    return 'DOCUMENT';
  };

  const handleLessonAttachmentUpload = async (file: File, mIdx: number, lIdx: number) => {
    const key = `${mIdx}-${lIdx}`;
    setUploadingAttachmentKey(key);
    try {
      const uploaded = await uploadToCourseMedia(file, 'attachments');
      const attType = inferAttachmentType(uploaded.mimetype || file.type || '', file.name);
      const nextAttachment = {
        title: file.name.replace(/\.[^.]+$/, '') || file.name,
        fileUrl: uploaded.fileUrl,
        fileType: attType,
        fileSize: uploaded.size || file.size || 0,
        isDownload: true,
      };
      setData((prev: any) => {
        const modules = [...(prev.modules || [])];
        const lessons = [...(modules[mIdx]?.lessons || [])];
        const existingAttachments = Array.isArray(lessons[lIdx]?.attachments) ? lessons[lIdx].attachments : [];
        lessons[lIdx] = { ...lessons[lIdx], attachments: [...existingAttachments, nextAttachment] };
        modules[mIdx] = { ...modules[mIdx], lessons };
        return { ...prev, modules };
      });
      toast.success(`Attached "${file.name}" to lesson`);
    } catch (err: any) {
      toast.error(err.message || 'Attachment upload failed');
    } finally {
      setUploadingAttachmentKey(null);
    }
  };

  const updateMarketing = (field: string, value: any) => {
    setData((prev: any) => ({
      ...prev,
      marketing_data: {
        ...prev.marketing_data,
        [field]: value,
      },
    }));
  };

  const mData = data.marketing_data;

  const generateSlug = (titleStr: string) =>
    titleStr
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

  const handleSubmit = () => {
    if (!data.title?.trim()) {
      toast.error('Course title is required');
      setCurrentStep(0);
      return;
    }

    const finalSlug = data.slug?.trim() || generateSlug(data.title);
    if (!finalSlug) {
      toast.error('Please enter a valid URL slug');
      setCurrentStep(0);
      return;
    }

    const FEATURE_PALETTES = [
      {
        gradient: 'from-blue-500/10 to-indigo-500/10',
        border: 'group-hover:border-blue-500/30',
        iconColor: 'text-blue-600',
        dotColor: 'bg-blue-500',
      },
      {
        gradient: 'from-emerald-500/10 to-teal-500/10',
        border: 'group-hover:border-emerald-500/30',
        iconColor: 'text-emerald-600',
        dotColor: 'bg-emerald-500',
      },
      {
        gradient: 'from-amber-500/10 to-orange-500/10',
        border: 'group-hover:border-amber-500/30',
        iconColor: 'text-amber-600',
        dotColor: 'bg-amber-500',
      },
      {
        gradient: 'from-rose-500/10 to-pink-500/10',
        border: 'group-hover:border-rose-500/30',
        iconColor: 'text-rose-600',
        dotColor: 'bg-rose-500',
      },
      {
        gradient: 'from-purple-500/10 to-fuchsia-500/10',
        border: 'group-hover:border-purple-500/30',
        iconColor: 'text-purple-600',
        dotColor: 'bg-purple-500',
      },
      {
        gradient: 'from-cyan-500/10 to-blue-500/10',
        border: 'group-hover:border-cyan-500/30',
        iconColor: 'text-cyan-600',
        dotColor: 'bg-cyan-500',
      },
    ];

    const cleanFeatures = (mData.numberedFeatures?.features || []).map((f: any, i: number) => {
      const p = FEATURE_PALETTES[i % FEATURE_PALETTES.length];
      return {
        ...f,
        gradient: f.gradient || p.gradient,
        border: f.border || p.border,
        iconColor: f.iconColor || p.iconColor,
      };
    });

    const cleanAudiences = (mData.whoIsThisForData || []).map((a: any, i: number) => {
      const p = FEATURE_PALETTES[i % FEATURE_PALETTES.length];
      const title = a.title || a.role || '';
      const description = a.description || a.desc || '';
      const bullets = Array.isArray(a.bullets) && a.bullets.length > 0
        ? a.bullets
        : (Array.isArray(a.points) ? a.points : []);
      return {
        ...a,
        title,
        role: title,
        description,
        desc: description,
        bullets,
        points: bullets,
        gradient: a.gradient || p.gradient,
        border: a.border || p.border,
        iconColor: a.iconColor || p.iconColor,
        dotColor: a.dotColor || p.dotColor,
      };
    });

    const cleanHighlights = (mData.highlightsData || []).map((h: any, i: number) => {
      const p = FEATURE_PALETTES[i % FEATURE_PALETTES.length];
      return {
        ...h,
        gradient: h.gradient || p.gradient,
        border: h.border || p.border,
        iconColor: h.iconColor || p.iconColor,
      };
    });

    const cleanBenefits = (mData.designedToHelp?.benefits || []).map((b: any, i: number) => {
      const p = FEATURE_PALETTES[i % FEATURE_PALETTES.length];
      return {
        ...b,
        gradient: b.gradient || p.gradient,
        border: b.border || p.border,
        iconColor: b.iconColor || p.iconColor,
      };
    });

    const cleanToolsGroups = (mData.categorizedToolsData || []).map((group: any) => {
      const categoryName = group.category || group.title || 'Tools';
      const toolsList = (group.tools || group.items || []).map((t: any) => ({
        name: t.name || '',
        iconUrl: t.iconUrl || getToolIcon(t.name),
      }));
      return {
        ...group,
        category: categoryName,
        title: categoryName,
        tools: toolsList,
        items: toolsList,
      };
    });

    const flatToolNames: string[] = [];
    cleanToolsGroups.forEach((g: any) => {
      (g.tools || []).forEach((t: any) => {
        if (t.name && !flatToolNames.includes(t.name)) {
          flatToolNames.push(t.name);
        }
      });
    });

    const curriculum = (data.modules || []).map((m: any, idx: number) => ({
      module: m.title || `Module ${idx + 1}`,
      topics: (m.lessons || [])
        .map((l: any) => (typeof l === 'string' ? l : l.title || ''))
        .filter(Boolean),
    }));

    const numericPrice =
      Number(String(data.discountedPrice || data.originalPrice || '0').replace(/[^0-9.]/g, '')) || 0;

    const extConfig = {
      schemaVersion: 1,
      featureFlags: {
        ...DEFAULT_EXTENSIBLE_CONFIG.featureFlags,
        ...(data.extensibleConfig?.featureFlags || {}),
        showCareerFeatures: mData.showCareerFeatures !== false,
      },
      customAttributes: (data.extensibleConfig?.customAttributes || []).filter((a: any) => a.key?.trim() && a.label?.trim()),
      customSections: (data.extensibleConfig?.customSections || []).filter((s: any) => s.title?.trim()),
    };

    const payload: any = {
      title: data.title.trim(),
      slug: finalSlug,
      categoryId: data.categoryId || null,
      level: data.level || 'Beginner to Advanced',
      subTitle: data.subtitle || '',
      description: data.description || '',
      duration: data.duration || '',
      format: data.format || 'Online / Classroom',
      price: numericPrice,
      originalPrice: data.originalPrice || '',
      discountedPrice: data.discountedPrice || '',
      batchInfo: data.batchInfo || '',
      location: data.location || '',
      thumbnailUrl: data.cardImage || null,
      bannerUrl: data.bannerImage || null,
      brochureUrl: data.brochureUrl || null,
      status: data.isPublished ? 'PUBLISHED' : 'DRAFT',
      extensibleConfig: extConfig,
      marketing_data: {
        ...mData,
        extensibleConfig: extConfig,
        curriculum,
        highlightsData: cleanHighlights,
        designedToHelp: {
          ...(mData.designedToHelp || {}),
          benefits: cleanBenefits,
        },
        numberedFeatures: {
          ...(mData.numberedFeatures || {}),
          features: cleanFeatures,
        },
        whoIsThisForData: cleanAudiences,
        categorizedToolsData: cleanToolsGroups,
        tools: flatToolNames,
      },
    };

    // Only send modules if not locked (otherwise backend safely rejects locked mutation)
    if (!data.isCurriculumLocked) {
      payload.modules = (data.modules || []).map((m: any, mIdx: number) => ({
        title: m.title || `Module ${mIdx + 1}`,
        description: m.description || null,
        position: mIdx,
        chapters: (m.lessons || []).map((l: any, cIdx: number) => ({
          title: l.title || `Lesson ${cIdx + 1}`,
          description: l.description || null,
          videoUrl: l.videoUrl || null,
          pdfUrl: l.pdfUrl || null,
          duration: l.duration || '10:00',
          position: cIdx,
          isFree: Boolean(l.isFree),
          attachments: (l.attachments || [])
            .filter((att: any) => att.fileUrl?.trim())
            .map((att: any) => ({
              title: att.title?.trim() || 'Resource',
              fileUrl: att.fileUrl.trim(),
              fileType: att.fileType || 'PDF',
              fileSize: Number(att.fileSize) || 0,
              isDownload: att.isDownload !== false,
            })),
        })),
      }));
    }

    onComplete(payload);
  };

  return (
    <div className="w-full space-y-5">
      {/* Stepper Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#006FFF]">
            Step {currentStep + 1} of {STEPS.length} — Course Wizard
          </span>
          <h2 className="font-display text-xl font-bold text-slate-900 mt-0.5">
            {STEPS[currentStep]}
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {STEPS.map((step, idx) => (
            <button
              key={step}
              type="button"
              onClick={() => setCurrentStep(idx)}
              className={`h-8 px-2.5 rounded-lg text-xs font-bold transition-all ${
                currentStep === idx
                  ? 'bg-[#006FFF] text-white shadow-sm'
                  : idx < currentStep
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
              title={step}
            >
              {idx + 1}. <span className="hidden xl:inline">{step}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !data.title?.trim()}
            className="px-4 py-2 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditMode ? 'Save Changes' : 'Save Course'}
          </button>
        </div>
      </div>

      {/* Main Step Body */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 min-h-[450px]">
        {/* STEP 0: Basic Details */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Course Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={data.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setData((prev: any) => ({
                      ...prev,
                      title: val,
                      slug: !isEditMode && !prev.slugTouched ? generateSlug(val) : prev.slug,
                    }));
                  }}
                  placeholder="e.g. AI-Powered Digital Marketing Course"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#006FFF] outline-none text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  URL Slug <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={data.slug}
                  onChange={(e) =>
                    setData({ ...data, slug: e.target.value, slugTouched: true })
                  }
                  placeholder="e.g. ai-powered-digital-marketing"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#006FFF] outline-none text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Course Category</label>
                <select
                  value={data.categoryId || ''}
                  onChange={(e) => setData({ ...data, categoryId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#006FFF] outline-none text-sm bg-white"
                >
                  <option value="">-- Uncategorized --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Difficulty Level</label>
                <select
                  value={data.level || 'Beginner to Advanced'}
                  onChange={(e) => setData({ ...data, level: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#006FFF] outline-none text-sm bg-white"
                >
                  <option value="Beginner to Advanced">Beginner to Advanced</option>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Format</label>
                <input
                  type="text"
                  value={data.format}
                  onChange={(e) => setData({ ...data, format: e.target.value })}
                  placeholder="e.g. Online / Classroom"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#006FFF] outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Subtitle / Tagline</label>
              <input
                type="text"
                value={data.subtitle}
                onChange={(e) => setData({ ...data, subtitle: e.target.value })}
                placeholder="e.g. Learn how to 10x your marketing output using generative AI"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#006FFF] outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">Short Description</label>
              <textarea
                value={data.description}
                onChange={(e) => setData({ ...data, description: e.target.value })}
                rows={3}
                placeholder="A compelling summary for the course catalogue card..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#006FFF] outline-none text-sm"
              />
            </div>

            {/* Course Images & Brochure */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-5">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="font-display text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#006FFF]" />
                  Course Media, Banners &amp; Brochure PDF
                </h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* 1. Card Thumbnail */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-900">Card Image (16:9)</label>
                      <span className="text-[10px] font-bold text-[#006FFF] bg-blue-50 px-2 py-0.5 rounded-full">
                        800x450
                      </span>
                    </div>
                    <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-slate-200 bg-slate-900 mb-2">
                      {data.cardImage ? (
                        <>
                          <img src={data.cardImage} alt="Card" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setData({ ...data, cardImage: '' })}
                            className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                          <ImageIcon className="w-6 h-6 mb-1 opacity-50" /> Placeholder Active
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      value={data.cardImage || ''}
                      onChange={(e) => setData({ ...data, cardImage: e.target.value })}
                      placeholder="Image URL..."
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-[#006FFF] outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={cardFileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f, 'card');
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingCard}
                      onClick={() => cardFileInputRef.current?.click()}
                      className="w-full py-2 rounded-lg border border-dashed border-slate-300 hover:border-[#006FFF] text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5"
                    >
                      {uploadingCard ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Upload Card
                    </button>
                  </div>
                </div>

                {/* 2. Hero Banner */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-900">Hero Banner</label>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        1920x600
                      </span>
                    </div>
                    <div className="relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-slate-200 bg-slate-900 mb-2">
                      {data.bannerImage ? (
                        <>
                          <img src={data.bannerImage} alt="Banner" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setData({ ...data, bannerImage: '' })}
                            className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                          <ImageIcon className="w-6 h-6 mb-1 opacity-50" /> Placeholder Active
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      value={data.bannerImage || ''}
                      onChange={(e) => setData({ ...data, bannerImage: e.target.value })}
                      placeholder="Banner URL..."
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-[#006FFF] outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={bannerFileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f, 'banner');
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingBanner}
                      onClick={() => bannerFileInputRef.current?.click()}
                      className="w-full py-2 rounded-lg border border-dashed border-slate-300 hover:border-[#006FFF] text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5"
                    >
                      {uploadingBanner ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Upload Banner
                    </button>
                  </div>
                </div>

                {/* 3. Brochure PDF */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-900">Syllabus / Brochure PDF</label>
                    </div>
                    <div className="w-full aspect-[16/9] rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-3 mb-2 text-center">
                      <FileText className={`w-8 h-8 mb-1 ${data.brochureUrl ? 'text-emerald-600' : 'text-slate-300'}`} />
                      <span className="text-[11px] font-semibold text-slate-700 truncate max-w-full">
                        {data.brochureUrl ? 'Brochure PDF Linked' : 'No Brochure Uploaded'}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={data.brochureUrl || ''}
                      onChange={(e) => setData({ ...data, brochureUrl: e.target.value })}
                      placeholder="PDF URL..."
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-[#006FFF] outline-none"
                    />
                  </div>
                  <div>
                    <input
                      type="file"
                      ref={brochureFileInputRef}
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f, 'brochure');
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingBrochure}
                      onClick={() => brochureFileInputRef.current?.click()}
                      className="w-full py-2 rounded-lg border border-dashed border-slate-300 hover:border-[#006FFF] text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5"
                    >
                      {uploadingBrochure ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Upload PDF Brochure
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Duration</label>
                <input
                  type="text"
                  value={data.duration}
                  onChange={(e) => setData({ ...data, duration: e.target.value })}
                  placeholder="e.g. 12 Weeks"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#006FFF] outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Location</label>
                <input
                  type="text"
                  value={data.location}
                  onChange={(e) => setData({ ...data, location: e.target.value })}
                  placeholder="e.g. Chennai / Online LMS"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#006FFF] outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Batch Information</label>
                <input
                  type="text"
                  value={data.batchInfo}
                  onChange={(e) => setData({ ...data, batchInfo: e.target.value })}
                  placeholder="e.g. Weekday & Weekend Batches"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#006FFF] outline-none text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Original Price (₹)</label>
                <input
                  type="text"
                  value={data.originalPrice}
                  onChange={(e) => setData({ ...data, originalPrice: e.target.value })}
                  placeholder="e.g. 49999"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#006FFF] outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Discounted / Active Price (₹)</label>
                <input
                  type="text"
                  value={data.discountedPrice}
                  onChange={(e) => setData({ ...data, discountedPrice: e.target.value })}
                  placeholder="e.g. 24999"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#006FFF] outline-none text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={data.isPublished}
                  onChange={(e) => setData({ ...data, isPublished: e.target.checked })}
                  className="w-4 h-4 rounded text-[#006FFF]"
                />
                <span className="text-xs font-bold text-slate-800">
                  Publish Course (Make available to franchises upon save)
                </span>
              </label>

              <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mData.showCareerFeatures !== false}
                  onChange={(e) => updateMarketing('showCareerFeatures', e.target.checked)}
                  className="w-4 h-4 rounded text-[#006FFF]"
                />
                <span className="text-xs font-bold text-slate-800">
                  Show Career &amp; Placement Support Features
                </span>
              </label>
            </div>
          </div>
        )}

        {/* STEP 1: Course Overview */}
        {currentStep === 1 && (
          <div className="space-y-8">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-[#006FFF]" /> Course Overview Paragraphs
              </h3>
              <div className="space-y-3">
                {(mData.overviewDescription || []).map((para: string, idx: number) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <textarea
                      value={para}
                      onChange={(e) => {
                        const list = [...mData.overviewDescription];
                        list[idx] = e.target.value;
                        updateMarketing('overviewDescription', list);
                      }}
                      rows={2}
                      placeholder={`Paragraph ${idx + 1}...`}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#006FFF]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateMarketing(
                          'overviewDescription',
                          mData.overviewDescription.filter((_: any, i: number) => i !== idx)
                        )
                      }
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateMarketing('overviewDescription', [...(mData.overviewDescription || []), ''])
                  }
                  className="px-4 py-2 rounded-xl border border-dashed border-[#006FFF] text-[#006FFF] text-xs font-bold flex items-center gap-1.5 hover:bg-blue-50"
                >
                  <Plus className="w-4 h-4" /> Add Overview Paragraph
                </button>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-emerald-600" /> Key Learning Outcomes
              </h3>
              <div className="space-y-2.5">
                {(mData.overviewLearnings || []).map((item: string, idx: number) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => {
                        const list = [...mData.overviewLearnings];
                        list[idx] = e.target.value;
                        updateMarketing('overviewLearnings', list);
                      }}
                      placeholder={`Learning outcome ${idx + 1}...`}
                      className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-[#006FFF]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateMarketing(
                          'overviewLearnings',
                          mData.overviewLearnings.filter((_: any, i: number) => i !== idx)
                        )
                      }
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateMarketing('overviewLearnings', [...(mData.overviewLearnings || []), ''])
                  }
                  className="px-4 py-2 rounded-xl border border-dashed border-emerald-600 text-emerald-700 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-50"
                >
                  <Plus className="w-4 h-4" /> Add Learning Outcome
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Designed To Help */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Section Title</label>
                <input
                  type="text"
                  value={mData.designedToHelp.title}
                  onChange={(e) =>
                    updateMarketing('designedToHelp', { ...mData.designedToHelp, title: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Section Description</label>
                <input
                  type="text"
                  value={mData.designedToHelp.description}
                  onChange={(e) =>
                    updateMarketing('designedToHelp', {
                      ...mData.designedToHelp,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                />
              </div>
            </div>

            <div className="space-y-3">
              {(mData.designedToHelp.benefits || []).map((benefit: any, idx: number) => (
                <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-[#006FFF]">Benefit Card #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const list = mData.designedToHelp.benefits.filter((_: any, i: number) => i !== idx);
                        updateMarketing('designedToHelp', { ...mData.designedToHelp, benefits: list });
                      }}
                      className="text-rose-500 text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                      <input
                        type="text"
                        value={benefit.title}
                        onChange={(e) => {
                          const list = [...mData.designedToHelp.benefits];
                          list[idx] = { ...list[idx], title: e.target.value };
                          updateMarketing('designedToHelp', { ...mData.designedToHelp, benefits: list });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Icon</label>
                      <IconPickerDropdown
                        value={benefit.iconName || 'CheckCircle'}
                        onChange={(val) => {
                          const list = [...mData.designedToHelp.benefits];
                          list[idx] = { ...list[idx], iconName: val };
                          updateMarketing('designedToHelp', { ...mData.designedToHelp, benefits: list });
                        }}
                      />
                    </div>
                  </div>
                  <textarea
                    value={benefit.description}
                    onChange={(e) => {
                      const list = [...mData.designedToHelp.benefits];
                      list[idx] = { ...list[idx], description: e.target.value };
                      updateMarketing('designedToHelp', { ...mData.designedToHelp, benefits: list });
                    }}
                    placeholder="Benefit description..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const list = [
                    ...(mData.designedToHelp.benefits || []),
                    { title: '', iconName: 'CheckCircle', description: '' },
                  ];
                  updateMarketing('designedToHelp', { ...mData.designedToHelp, benefits: list });
                }}
                className="px-4 py-2 rounded-xl border border-dashed border-[#006FFF] text-[#006FFF] text-xs font-bold flex items-center gap-1.5 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4" /> Add Benefit Card
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Numbered Features */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Section Title</label>
                <input
                  type="text"
                  value={mData.numberedFeatures.title}
                  onChange={(e) =>
                    updateMarketing('numberedFeatures', {
                      ...mData.numberedFeatures,
                      title: e.target.value,
                    })
                  }
                  placeholder="e.g. AI-Powered Curriculum Methodology"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Section Description</label>
                <input
                  type="text"
                  value={mData.numberedFeatures.description}
                  onChange={(e) =>
                    updateMarketing('numberedFeatures', {
                      ...mData.numberedFeatures,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                />
              </div>
            </div>

            <div className="space-y-3">
              {(mData.numberedFeatures.features || []).map((feat: any, idx: number) => (
                <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-[#006FFF]">Feature #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const list = mData.numberedFeatures.features.filter((_: any, i: number) => i !== idx);
                        updateMarketing('numberedFeatures', { ...mData.numberedFeatures, features: list });
                      }}
                      className="text-rose-500 text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Badge Num</label>
                      <input
                        type="text"
                        value={feat.num}
                        onChange={(e) => {
                          const list = [...mData.numberedFeatures.features];
                          list[idx] = { ...list[idx], num: e.target.value };
                          updateMarketing('numberedFeatures', { ...mData.numberedFeatures, features: list });
                        }}
                        placeholder="01"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                      <input
                        type="text"
                        value={feat.title}
                        onChange={(e) => {
                          const list = [...mData.numberedFeatures.features];
                          list[idx] = { ...list[idx], title: e.target.value };
                          updateMarketing('numberedFeatures', { ...mData.numberedFeatures, features: list });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Icon</label>
                      <IconPickerDropdown
                        value={feat.iconName || 'Zap'}
                        onChange={(val) => {
                          const list = [...mData.numberedFeatures.features];
                          list[idx] = { ...list[idx], iconName: val };
                          updateMarketing('numberedFeatures', { ...mData.numberedFeatures, features: list });
                        }}
                      />
                    </div>
                  </div>
                  <textarea
                    value={feat.description}
                    onChange={(e) => {
                      const list = [...mData.numberedFeatures.features];
                      list[idx] = { ...list[idx], description: e.target.value };
                      updateMarketing('numberedFeatures', { ...mData.numberedFeatures, features: list });
                    }}
                    placeholder="Feature details..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const nextNum = String((mData.numberedFeatures.features?.length || 0) + 1).padStart(2, '0');
                  const list = [
                    ...(mData.numberedFeatures.features || []),
                    { num: nextNum, title: '', iconName: 'Zap', description: '' },
                  ];
                  updateMarketing('numberedFeatures', { ...mData.numberedFeatures, features: list });
                }}
                className="px-4 py-2 rounded-xl border border-dashed border-[#006FFF] text-[#006FFF] text-xs font-bold flex items-center gap-1.5 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4" /> Add Numbered Feature
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Why Digital Ghuru */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-800 mb-1">Section Main Heading</label>
              <input
                type="text"
                value={mData.whyDigitalGhuru.title}
                onChange={(e) =>
                  updateMarketing('whyDigitalGhuru', { ...mData.whyDigitalGhuru, title: e.target.value })
                }
                placeholder="Why Choose Digital Ghuru?"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
              />
            </div>

            <div className="space-y-3">
              {(mData.whyDigitalGhuru.reasons || []).map((reason: any, idx: number) => (
                <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-[#006FFF]">Reason #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const list = mData.whyDigitalGhuru.reasons.filter((_: any, i: number) => i !== idx);
                        updateMarketing('whyDigitalGhuru', { ...mData.whyDigitalGhuru, reasons: list });
                      }}
                      className="text-rose-500 text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Num</label>
                      <input
                        type="text"
                        value={reason.num}
                        onChange={(e) => {
                          const list = [...mData.whyDigitalGhuru.reasons];
                          list[idx] = { ...list[idx], num: e.target.value };
                          updateMarketing('whyDigitalGhuru', { ...mData.whyDigitalGhuru, reasons: list });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                      <input
                        type="text"
                        value={reason.title}
                        onChange={(e) => {
                          const list = [...mData.whyDigitalGhuru.reasons];
                          list[idx] = { ...list[idx], title: e.target.value };
                          updateMarketing('whyDigitalGhuru', { ...mData.whyDigitalGhuru, reasons: list });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Icon</label>
                      <IconPickerDropdown
                        value={reason.iconName || 'Award'}
                        onChange={(val) => {
                          const list = [...mData.whyDigitalGhuru.reasons];
                          list[idx] = { ...list[idx], iconName: val };
                          updateMarketing('whyDigitalGhuru', { ...mData.whyDigitalGhuru, reasons: list });
                        }}
                      />
                    </div>
                  </div>
                  <textarea
                    value={reason.description}
                    onChange={(e) => {
                      const list = [...mData.whyDigitalGhuru.reasons];
                      list[idx] = { ...list[idx], description: e.target.value };
                      updateMarketing('whyDigitalGhuru', { ...mData.whyDigitalGhuru, reasons: list });
                    }}
                    placeholder="Reason description..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const nextNum = String((mData.whyDigitalGhuru.reasons?.length || 0) + 1).padStart(2, '0');
                  const list = [
                    ...(mData.whyDigitalGhuru.reasons || []),
                    { num: nextNum, title: '', iconName: 'Award', description: '' },
                  ];
                  updateMarketing('whyDigitalGhuru', { ...mData.whyDigitalGhuru, reasons: list });
                }}
                className="px-4 py-2 rounded-xl border border-dashed border-[#006FFF] text-[#006FFF] text-xs font-bold flex items-center gap-1.5 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4" /> Add Differentiator Reason
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Target Audience */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#006FFF]" /> Who Is This Course For?
            </h3>
            {(mData.whoIsThisForData || []).map((aud: any, idx: number) => {
              const bulletList: string[] = Array.isArray(aud.bullets) && aud.bullets.length > 0
                ? aud.bullets
                : (Array.isArray(aud.points) ? aud.points : []);
              return (
              <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-[#006FFF]">Persona #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateMarketing(
                        'whoIsThisForData',
                        mData.whoIsThisForData.filter((_: any, i: number) => i !== idx)
                      )
                    }
                    className="text-rose-500 text-xs font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Persona / Role</label>
                    <input
                      type="text"
                      value={aud.title || aud.role || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const list = [...mData.whoIsThisForData];
                        list[idx] = { ...list[idx], title: val, role: val };
                        updateMarketing('whoIsThisForData', list);
                      }}
                      placeholder="e.g. Aspiring Marketing Professionals & Students"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Icon</label>
                    <IconPickerDropdown
                      value={aud.iconName || 'User'}
                      onChange={(val) => {
                        const list = [...mData.whoIsThisForData];
                        list[idx] = { ...list[idx], iconName: val };
                        updateMarketing('whoIsThisForData', list);
                      }}
                    />
                  </div>
                </div>
                <textarea
                  value={aud.description || aud.desc || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const list = [...mData.whoIsThisForData];
                    list[idx] = { ...list[idx], description: val, desc: val };
                    updateMarketing('whoIsThisForData', list);
                  }}
                  placeholder="Persona background & goal..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600">Key Takeaways</label>
                  {bulletList.map((b: string, bIdx: number) => (
                    <div key={bIdx} className="flex gap-2">
                      <input
                        type="text"
                        value={b}
                        onChange={(e) => {
                          const list = [...mData.whoIsThisForData];
                          const updatedBullets = [...bulletList];
                          updatedBullets[bIdx] = e.target.value;
                          list[idx] = { ...list[idx], bullets: updatedBullets, points: updatedBullets };
                          updateMarketing('whoIsThisForData', list);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const list = [...mData.whoIsThisForData];
                          const updatedBullets = bulletList.filter((_: any, j: number) => j !== bIdx);
                          list[idx] = {
                            ...list[idx],
                            bullets: updatedBullets,
                            points: updatedBullets,
                          };
                          updateMarketing('whoIsThisForData', list);
                        }}
                        className="text-rose-500 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const list = [...mData.whoIsThisForData];
                      const updatedBullets = [...bulletList, ''];
                      list[idx] = { ...list[idx], bullets: updatedBullets, points: updatedBullets };
                      updateMarketing('whoIsThisForData', list);
                    }}
                    className="text-[11px] font-bold text-[#006FFF] hover:underline"
                  >
                    + Add Bullet Point
                  </button>
                </div>
              </div>
              );
            })}
            <button
              type="button"
              onClick={() =>
                updateMarketing('whoIsThisForData', [
                  ...(mData.whoIsThisForData || []),
                  { title: '', role: '', iconName: 'Users', description: '', desc: '', bullets: [''], points: [''] },
                ])
              }
              className="px-4 py-2 rounded-xl border border-dashed border-[#006FFF] text-[#006FFF] text-xs font-bold flex items-center gap-1.5 hover:bg-blue-50"
            >
              <Plus className="w-4 h-4" /> Add Target Persona
            </button>
          </div>
        )}

        {/* STEP 6: Top Highlights */}
        {currentStep === 6 && (
          <div className="space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#006FFF]" /> Top Program Highlights
            </h3>
            {(mData.highlightsData || []).map((hl: any, idx: number) => (
              <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-[#006FFF]">Highlight #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateMarketing(
                        'highlightsData',
                        mData.highlightsData.filter((_: any, i: number) => i !== idx)
                      )
                    }
                    className="text-rose-500 text-xs font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={hl.title}
                      onChange={(e) => {
                        const list = [...mData.highlightsData];
                        list[idx] = { ...list[idx], title: e.target.value };
                        updateMarketing('highlightsData', list);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Icon</label>
                    <IconPickerDropdown
                      value={hl.iconName || 'Star'}
                      onChange={(val) => {
                        const list = [...mData.highlightsData];
                        list[idx] = { ...list[idx], iconName: val };
                        updateMarketing('highlightsData', list);
                      }}
                    />
                  </div>
                </div>
                <textarea
                  value={hl.description}
                  onChange={(e) => {
                    const list = [...mData.highlightsData];
                    list[idx] = { ...list[idx], description: e.target.value };
                    updateMarketing('highlightsData', list);
                  }}
                  placeholder="Highlight description..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                updateMarketing('highlightsData', [
                  ...(mData.highlightsData || []),
                  { title: '', iconName: 'Star', description: '' },
                ])
              }
              className="px-4 py-2 rounded-xl border border-dashed border-[#006FFF] text-[#006FFF] text-xs font-bold flex items-center gap-1.5 hover:bg-blue-50"
            >
              <Plus className="w-4 h-4" /> Add Program Highlight
            </button>
          </div>
        )}

        {/* STEP 7: Tools Mastered */}
        {currentStep === 7 && (
          <div className="space-y-5">
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <Laptop2 className="w-4 h-4 text-[#006FFF]" /> Categorized Tools &amp; Platforms
            </h3>
            {(mData.categorizedToolsData || []).map((group: any, gIdx: number) => (
              <div key={gIdx} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#006FFF]">
                    Tool Category #{gIdx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateMarketing(
                        'categorizedToolsData',
                        mData.categorizedToolsData.filter((_: any, i: number) => i !== gIdx)
                      )
                    }
                    className="text-rose-500 text-xs font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove Group
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Category Title</label>
                    <input
                      type="text"
                      value={group.category || group.title}
                      onChange={(e) => {
                        const list = [...mData.categorizedToolsData];
                        list[gIdx] = { ...list[gIdx], category: e.target.value, title: e.target.value };
                        updateMarketing('categorizedToolsData', list);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={group.description}
                      onChange={(e) => {
                        const list = [...mData.categorizedToolsData];
                        list[gIdx] = { ...list[gIdx], description: e.target.value };
                        updateMarketing('categorizedToolsData', list);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">Tools in Category</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {(group.tools || []).map((tool: any, tIdx: number) => (
                      <div key={tIdx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200">
                        <img
                          src={tool.iconUrl || getToolIcon(tool.name)}
                          alt={tool.name}
                          className="w-7 h-7 object-contain rounded shrink-0 bg-slate-50 p-1"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/tools/openai.svg';
                          }}
                        />
                        <div className="flex-1 grid grid-cols-2 gap-1.5">
                          <input
                            type="text"
                            value={tool.name}
                            onChange={(e) => {
                              const list = [...mData.categorizedToolsData];
                              const tools = [...list[gIdx].tools];
                              const name = e.target.value;
                              tools[tIdx] = { ...tools[tIdx], name, iconUrl: getToolIcon(name) };
                              list[gIdx] = { ...list[gIdx], tools, items: tools };
                              updateMarketing('categorizedToolsData', list);
                            }}
                            placeholder="Tool name..."
                            className="px-2 py-1 text-xs border border-slate-200 rounded"
                          />
                          <input
                            type="text"
                            value={tool.iconUrl || ''}
                            onChange={(e) => {
                              const list = [...mData.categorizedToolsData];
                              const tools = [...list[gIdx].tools];
                              tools[tIdx] = { ...tools[tIdx], iconUrl: e.target.value };
                              list[gIdx] = { ...list[gIdx], tools, items: tools };
                              updateMarketing('categorizedToolsData', list);
                            }}
                            placeholder="Icon URL..."
                            className="px-2 py-1 text-xs border border-slate-200 rounded"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const list = [...mData.categorizedToolsData];
                            const tools = list[gIdx].tools.filter((_: any, j: number) => j !== tIdx);
                            list[gIdx] = { ...list[gIdx], tools, items: tools };
                            updateMarketing('categorizedToolsData', list);
                          }}
                          className="text-rose-500 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-slate-200/70 space-y-2">
                    <div className="text-[11px] font-semibold text-slate-500">Quick add common tools:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_ADD_TOOLS.map((presetName) => (
                        <button
                          key={presetName}
                          type="button"
                          onClick={() => {
                            const list = [...mData.categorizedToolsData];
                            const existing = list[gIdx].tools || [];
                            if (existing.some((t: any) => t.name?.toLowerCase() === presetName.toLowerCase())) {
                              return;
                            }
                            const tools = [...existing, { name: presetName, iconUrl: getToolIcon(presetName) }];
                            list[gIdx] = { ...list[gIdx], tools, items: tools };
                            updateMarketing('categorizedToolsData', list);
                          }}
                          className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:border-[#006FFF] hover:text-[#006FFF] hover:bg-blue-50/50 transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> {presetName}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const list = [...mData.categorizedToolsData];
                      const tools = [...(list[gIdx].tools || []), { name: '', iconUrl: '/tools/openai.svg' }];
                      list[gIdx] = { ...list[gIdx], tools, items: tools };
                      updateMarketing('categorizedToolsData', list);
                    }}
                    className="text-xs font-bold text-[#006FFF] hover:underline"
                  >
                    + Add Custom Tool to {group.category || 'Category'}
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                updateMarketing('categorizedToolsData', [
                  ...(mData.categorizedToolsData || []),
                  {
                    category: 'New Tool Group',
                    title: 'New Tool Group',
                    description: '',
                    bgClass: 'bg-white',
                    textClass: 'text-[#0d2f62]',
                    tools: [],
                    items: [],
                  },
                ])
              }
              className="px-4 py-2 rounded-xl border border-dashed border-[#006FFF] text-[#006FFF] text-xs font-bold flex items-center gap-1.5 hover:bg-blue-50"
            >
              <Plus className="w-4 h-4" /> Add Tool Category
            </button>
          </div>
        )}

        {/* STEP 8: Modules & Lessons */}
        {currentStep === 8 && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#006FFF]" /> Course Modules, Video Lessons &amp; Resources
              </h3>
              {data.isCurriculumLocked && (
                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Published Curriculum Version Locked
                </span>
              )}
            </div>

            {data.isCurriculumLocked && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
                <div>
                  This course's active curriculum is published and locked in PostgreSQL so existing student progress &amp; certificates remain intact. Create a new editable draft version to add, reorder, or edit modules, lessons, videos, and downloadable attachments.
                </div>
                {data.id && onCreateDraftVersion && (
                  <button
                    type="button"
                    disabled={creatingDraftVersion}
                    onClick={() => onCreateDraftVersion(data.id)}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 shrink-0"
                  >
                    {creatingDraftVersion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitBranch className="w-3.5 h-3.5" />}
                    Create Draft Version to Edit
                  </button>
                )}
              </div>
            )}

            <div className={`space-y-4 ${data.isCurriculumLocked ? 'opacity-70 pointer-events-none' : ''}`}>
              {(data.modules || []).map((mod: any, mIdx: number) => (
                <div key={mIdx} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 flex items-center gap-3">
                      <span className="h-7 w-7 rounded-lg bg-[#006FFF] text-white text-xs font-bold flex items-center justify-center shrink-0">
                        M{mIdx + 1}
                      </span>
                      <input
                        type="text"
                        value={mod.title}
                        onChange={(e) => {
                          const list = [...data.modules];
                          list[mIdx] = { ...list[mIdx], title: e.target.value };
                          setData({ ...data, modules: list });
                        }}
                        placeholder="Module Title..."
                        className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white font-display font-bold text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={mIdx === 0}
                        onClick={() => {
                          if (mIdx === 0) return;
                          const list = [...data.modules];
                          [list[mIdx - 1], list[mIdx]] = [list[mIdx], list[mIdx - 1]];
                          setData({ ...data, modules: list });
                        }}
                        title="Move Module Up"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={mIdx === (data.modules?.length || 1) - 1}
                        onClick={() => {
                          if (mIdx >= data.modules.length - 1) return;
                          const list = [...data.modules];
                          [list[mIdx], list[mIdx + 1]] = [list[mIdx + 1], list[mIdx]];
                          setData({ ...data, modules: list });
                        }}
                        title="Move Module Down"
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setData({
                            ...data,
                            modules: data.modules.filter((_: any, i: number) => i !== mIdx),
                          })
                        }
                        className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Lessons inside Module */}
                  <div className="pl-4 sm:pl-8 space-y-3">
                    {(mod.lessons || []).map((lesson: any, lIdx: number) => {
                      const attachments: any[] = Array.isArray(lesson.attachments) ? lesson.attachments : [];
                      const isUploadingAtt = uploadingAttachmentKey === `${mIdx}-${lIdx}`;
                      return (
                      <div key={lIdx} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                            <PlayCircle className="w-4 h-4 text-[#006FFF] shrink-0" />
                            <input
                              type="text"
                              value={lesson.title}
                              onChange={(e) => {
                                const list = [...data.modules];
                                const lessons = [...list[mIdx].lessons];
                                lessons[lIdx] = { ...lessons[lIdx], title: e.target.value };
                                list[mIdx] = { ...list[mIdx], lessons };
                                setData({ ...data, modules: list });
                              }}
                              placeholder={`Lesson ${lIdx + 1} Title...`}
                              className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                            />
                          </div>
                          <input
                            type="text"
                            value={lesson.duration || '10:00'}
                            onChange={(e) => {
                              const list = [...data.modules];
                              const lessons = [...list[mIdx].lessons];
                              lessons[lIdx] = { ...lessons[lIdx], duration: e.target.value };
                              list[mIdx] = { ...list[mIdx], lessons };
                              setData({ ...data, modules: list });
                            }}
                            placeholder="10:00"
                            className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-center"
                          />
                          <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(lesson.isFree)}
                              onChange={(e) => {
                                const list = [...data.modules];
                                const lessons = [...list[mIdx].lessons];
                                lessons[lIdx] = { ...lessons[lIdx], isFree: e.target.checked };
                                list[mIdx] = { ...list[mIdx], lessons };
                                setData({ ...data, modules: list });
                              }}
                            />
                            Free Preview
                          </label>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              disabled={lIdx === 0}
                              onClick={() => {
                                const list = [...data.modules];
                                const lessons = [...list[mIdx].lessons];
                                [lessons[lIdx - 1], lessons[lIdx]] = [lessons[lIdx], lessons[lIdx - 1]];
                                list[mIdx] = { ...list[mIdx], lessons };
                                setData({ ...data, modules: list });
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={lIdx === (mod.lessons?.length || 1) - 1}
                              onClick={() => {
                                const list = [...data.modules];
                                const lessons = [...list[mIdx].lessons];
                                [lessons[lIdx], lessons[lIdx + 1]] = [lessons[lIdx + 1], lessons[lIdx]];
                                list[mIdx] = { ...list[mIdx], lessons };
                                setData({ ...data, modules: list });
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const list = [...data.modules];
                                const lessons = list[mIdx].lessons.filter((_: any, j: number) => j !== lIdx);
                                list[mIdx] = { ...list[mIdx], lessons };
                                setData({ ...data, modules: list });
                              }}
                              className="text-rose-500 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={lesson.description || ''}
                          onChange={(e) => {
                            const list = [...data.modules];
                            const lessons = [...list[mIdx].lessons];
                            lessons[lIdx] = { ...lessons[lIdx], description: e.target.value };
                            list[mIdx] = { ...list[mIdx], lessons };
                            setData({ ...data, modules: list });
                          }}
                          placeholder="Optional lesson summary / learning notes..."
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600"
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          <div className="flex items-center gap-1.5">
                            <Video className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <input
                              type="url"
                              value={lesson.videoUrl || ''}
                              onChange={(e) => {
                                const list = [...data.modules];
                                const lessons = [...list[mIdx].lessons];
                                lessons[lIdx] = { ...lessons[lIdx], videoUrl: e.target.value };
                                list[mIdx] = { ...list[mIdx], lessons };
                                setData({ ...data, modules: list });
                              }}
                              placeholder="Google Drive, YouTube, or MP4 URL..."
                              className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <LinkIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <input
                              type="url"
                              value={lesson.pdfUrl || ''}
                              onChange={(e) => {
                                const list = [...data.modules];
                                const lessons = [...list[mIdx].lessons];
                                lessons[lIdx] = { ...lessons[lIdx], pdfUrl: e.target.value };
                                list[mIdx] = { ...list[mIdx], lessons };
                                setData({ ...data, modules: list });
                              }}
                              placeholder="Primary Lesson PDF / Note URL..."
                              className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                            />
                          </div>
                        </div>

                        {/* Multi-Resource Lesson Attachments */}
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                              <Paperclip className="w-3 h-3 text-[#006FFF]" /> Lesson Attachments &amp; Downloads ({attachments.length})
                            </span>
                            <div className="flex items-center gap-2">
                              <label className="cursor-pointer px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1">
                                {isUploadingAtt ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                Upload File
                                <input
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.zip,.doc,.docx,.ppt,.pptx,.csv,.txt,image/*"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleLessonAttachmentUpload(f, mIdx, lIdx);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const list = [...data.modules];
                                  const lessons = [...list[mIdx].lessons];
                                  lessons[lIdx] = {
                                    ...lessons[lIdx],
                                    attachments: [
                                      ...attachments,
                                      { title: '', fileUrl: '', fileType: 'PDF', fileSize: 0, isDownload: true },
                                    ],
                                  };
                                  list[mIdx] = { ...list[mIdx], lessons };
                                  setData({ ...data, modules: list });
                                }}
                                className="text-[11px] font-bold text-[#006FFF] hover:underline"
                              >
                                + Add Link/PDF
                              </button>
                            </div>
                          </div>

                          {attachments.length > 0 && (
                            <div className="space-y-1.5">
                              {attachments.map((att: any, aIdx: number) => (
                                <div key={aIdx} className="grid grid-cols-1 md:grid-cols-12 gap-1.5 items-center bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                                  <input
                                    type="text"
                                    value={att.title || ''}
                                    onChange={(e) => {
                                      const list = [...data.modules];
                                      const lessons = [...list[mIdx].lessons];
                                      const nextAtts = [...attachments];
                                      nextAtts[aIdx] = { ...nextAtts[aIdx], title: e.target.value };
                                      lessons[lIdx] = { ...lessons[lIdx], attachments: nextAtts };
                                      list[mIdx] = { ...list[mIdx], lessons };
                                      setData({ ...data, modules: list });
                                    }}
                                    placeholder="Resource title..."
                                    className="md:col-span-3 px-2 py-1 rounded border border-slate-200 bg-white text-xs"
                                  />
                                  <select
                                    value={att.fileType || 'PDF'}
                                    onChange={(e) => {
                                      const list = [...data.modules];
                                      const lessons = [...list[mIdx].lessons];
                                      const nextAtts = [...attachments];
                                      nextAtts[aIdx] = { ...nextAtts[aIdx], fileType: e.target.value };
                                      lessons[lIdx] = { ...lessons[lIdx], attachments: nextAtts };
                                      list[mIdx] = { ...list[mIdx], lessons };
                                      setData({ ...data, modules: list });
                                    }}
                                    className="md:col-span-2 px-2 py-1 rounded border border-slate-200 bg-white text-xs"
                                  >
                                    <option value="PDF">PDF</option>
                                    <option value="DOCUMENT">DOC</option>
                                    <option value="ZIP">ZIP</option>
                                    <option value="IMAGE">IMAGE</option>
                                    <option value="EXTERNAL_LINK">LINK</option>
                                  </select>
                                  <input
                                    type="text"
                                    value={att.fileUrl || ''}
                                    onChange={(e) => {
                                      const list = [...data.modules];
                                      const lessons = [...list[mIdx].lessons];
                                      const nextAtts = [...attachments];
                                      nextAtts[aIdx] = { ...nextAtts[aIdx], fileUrl: e.target.value };
                                      lessons[lIdx] = { ...lessons[lIdx], attachments: nextAtts };
                                      list[mIdx] = { ...list[mIdx], lessons };
                                      setData({ ...data, modules: list });
                                    }}
                                    placeholder="/api/courses/media/... or https://..."
                                    className="md:col-span-5 px-2 py-1 rounded border border-slate-200 bg-white text-xs font-mono"
                                  />
                                  <label className="md:col-span-1 flex items-center justify-center gap-1 text-[10px] text-slate-600 cursor-pointer" title="Allow download">
                                    <input
                                      type="checkbox"
                                      checked={att.isDownload !== false}
                                      onChange={(e) => {
                                        const list = [...data.modules];
                                        const lessons = [...list[mIdx].lessons];
                                        const nextAtts = [...attachments];
                                        nextAtts[aIdx] = { ...nextAtts[aIdx], isDownload: e.target.checked };
                                        lessons[lIdx] = { ...lessons[lIdx], attachments: nextAtts };
                                        list[mIdx] = { ...list[mIdx], lessons };
                                        setData({ ...data, modules: list });
                                      }}
                                    />
                                    DL
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const list = [...data.modules];
                                      const lessons = [...list[mIdx].lessons];
                                      lessons[lIdx] = {
                                        ...lessons[lIdx],
                                        attachments: attachments.filter((_: any, j: number) => j !== aIdx),
                                      };
                                      list[mIdx] = { ...list[mIdx], lessons };
                                      setData({ ...data, modules: list });
                                    }}
                                    className="md:col-span-1 text-rose-500 p-1 flex justify-end"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        const list = [...data.modules];
                        const lessons = [
                          ...(list[mIdx].lessons || []),
                          { title: '', description: '', videoUrl: '', pdfUrl: '', duration: '15:00', isFree: false, attachments: [] },
                        ];
                        list[mIdx] = { ...list[mIdx], lessons };
                        setData({ ...data, modules: list });
                      }}
                      className="text-xs font-bold text-[#006FFF] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Lesson to Module {mIdx + 1}
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setData({
                    ...data,
                    modules: [
                      ...(data.modules || []),
                      {
                        title: `Module ${(data.modules?.length || 0) + 1}: New Topic`,
                        description: '',
                        lessons: [{ title: 'Lesson 1: Overview', description: '', videoUrl: '', pdfUrl: '', duration: '15:00', isFree: false, attachments: [] }],
                      },
                    ],
                  })
                }
                className="px-4 py-2 rounded-xl border border-dashed border-[#006FFF] text-[#006FFF] text-xs font-bold flex items-center gap-1.5 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4" /> Add New Module
              </button>
            </div>
          </div>
        )}

        {/* STEP 9: FAQs */}
        {currentStep === 9 && (
          <div className="space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900">Frequently Asked Questions</h3>
            {(mData.faqs || []).map((faq: any, idx: number) => (
              <div key={idx} className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-[#006FFF]">FAQ #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateMarketing(
                        'faqs',
                        mData.faqs.filter((_: any, i: number) => i !== idx)
                      )
                    }
                    className="text-rose-500 text-xs font-semibold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => {
                    const list = [...mData.faqs];
                    list[idx] = { ...list[idx], question: e.target.value };
                    updateMarketing('faqs', list);
                  }}
                  placeholder="Question..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold"
                />
                <textarea
                  value={faq.answer}
                  onChange={(e) => {
                    const list = [...mData.faqs];
                    list[idx] = { ...list[idx], answer: e.target.value };
                    updateMarketing('faqs', list);
                  }}
                  placeholder="Answer..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                updateMarketing('faqs', [...(mData.faqs || []), { question: '', answer: '' }])
              }
              className="px-4 py-2 rounded-xl border border-dashed border-[#006FFF] text-[#006FFF] text-xs font-bold flex items-center gap-1.5 hover:bg-blue-50"
            >
              <Plus className="w-4 h-4" /> Add FAQ
            </button>
          </div>
        )}

        {/* STEP 10: Extensible Feature Flags & Future Custom Course Blocks */}
        {currentStep === 10 && (
          <div className="space-y-8">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#006FFF]" /> Course Feature Controls &amp; Extensible Blocks
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure per-course LMS behavior (XP awards, certificates, preview access) and add custom metadata attributes or dynamic content sections without database schema rebuilds.
              </p>
            </div>

            {/* Feature Flags */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                LMS &amp; Module Feature Flags
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { key: 'certificatesEnabled', label: 'Enable Completion Certificates' },
                  { key: 'xpEnabled', label: 'Enable XP & Level Rewards' },
                  { key: 'allowFreePreview', label: 'Allow Free Preview Lessons' },
                  { key: 'quizzesEnabled', label: 'Enable Module Quizzes (Future Hook)' },
                  { key: 'assignmentsEnabled', label: 'Enable Capstone Assignments' },
                  { key: 'liveSessionsEnabled', label: 'Enable Live Doubt Sessions' },
                ].map((flag) => (
                  <label
                    key={flag.key}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(data.extensibleConfig?.featureFlags?.[flag.key])}
                      onChange={(e) =>
                        setData((prev: any) => ({
                          ...prev,
                          extensibleConfig: {
                            ...prev.extensibleConfig,
                            featureFlags: {
                              ...prev.extensibleConfig.featureFlags,
                              [flag.key]: e.target.checked,
                            },
                          },
                        }))
                      }
                      className="w-4 h-4 rounded text-[#006FFF]"
                    />
                    {flag.label}
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lesson Completion XP</label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={data.extensibleConfig?.featureFlags?.lessonXp ?? 10}
                    onChange={(e) =>
                      setData((prev: any) => ({
                        ...prev,
                        extensibleConfig: {
                          ...prev.extensibleConfig,
                          featureFlags: {
                            ...prev.extensibleConfig.featureFlags,
                            lessonXp: Number(e.target.value) || 0,
                          },
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Full Course Completion Bonus XP</label>
                  <input
                    type="number"
                    min={0}
                    max={5000}
                    value={data.extensibleConfig?.featureFlags?.completionXp ?? 100}
                    onChange={(e) =>
                      setData((prev: any) => ({
                        ...prev,
                        extensibleConfig: {
                          ...prev.extensibleConfig,
                          featureFlags: {
                            ...prev.extensibleConfig.featureFlags,
                            completionXp: Number(e.target.value) || 0,
                          },
                        },
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Custom Metadata Attributes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Custom Course Attributes</h4>
                  <p className="text-xs text-slate-500">Add arbitrary key-value course metadata (e.g. Accreditation Partner, Internship Hours, Age Group).</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setData((prev: any) => ({
                      ...prev,
                      extensibleConfig: {
                        ...prev.extensibleConfig,
                        customAttributes: [
                          ...(prev.extensibleConfig?.customAttributes || []),
                          { key: '', label: '', value: '', type: 'TEXT' },
                        ],
                      },
                    }))
                  }
                  className="px-3 py-1.5 rounded-xl border border-dashed border-[#006FFF] text-[#006FFF] text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Attribute
                </button>
              </div>
              {(data.extensibleConfig?.customAttributes || []).map((attr: any, idx: number) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-3 rounded-xl border border-slate-200 bg-white">
                  <input
                    type="text"
                    value={attr.label}
                    onChange={(e) => {
                      const val = e.target.value;
                      const list = [...(data.extensibleConfig?.customAttributes || [])];
                      list[idx] = {
                        ...list[idx],
                        label: val,
                        key: list[idx].key || val.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, ''),
                      };
                      setData((prev: any) => ({
                        ...prev,
                        extensibleConfig: { ...prev.extensibleConfig, customAttributes: list },
                      }));
                    }}
                    placeholder="Display Label (e.g. Internship Included)"
                    className="sm:col-span-4 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                  <input
                    type="text"
                    value={attr.key}
                    onChange={(e) => {
                      const list = [...(data.extensibleConfig?.customAttributes || [])];
                      list[idx] = { ...list[idx], key: e.target.value };
                      setData((prev: any) => ({
                        ...prev,
                        extensibleConfig: { ...prev.extensibleConfig, customAttributes: list },
                      }));
                    }}
                    placeholder="machine_key"
                    className="sm:col-span-3 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={attr.value}
                    onChange={(e) => {
                      const list = [...(data.extensibleConfig?.customAttributes || [])];
                      list[idx] = { ...list[idx], value: e.target.value };
                      setData((prev: any) => ({
                        ...prev,
                        extensibleConfig: { ...prev.extensibleConfig, customAttributes: list },
                      }));
                    }}
                    placeholder="Value..."
                    className="sm:col-span-4 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const list = (data.extensibleConfig?.customAttributes || []).filter((_: any, i: number) => i !== idx);
                      setData((prev: any) => ({
                        ...prev,
                        extensibleConfig: { ...prev.extensibleConfig, customAttributes: list },
                      }));
                    }}
                    className="sm:col-span-1 text-rose-500 p-1 flex justify-end"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Dynamic Extensible Content Sections */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Dynamic Custom Content Sections</h4>
                  <p className="text-xs text-slate-500">Define new modular sections (e.g. Placement Companies, Certifications, Lab Projects) dynamically.</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setData((prev: any) => ({
                      ...prev,
                      extensibleConfig: {
                        ...prev.extensibleConfig,
                        customSections: [
                          ...(prev.extensibleConfig?.customSections || []),
                          {
                            id: `sec_${Date.now()}`,
                            key: `custom_section_${(prev.extensibleConfig?.customSections?.length || 0) + 1}`,
                            title: 'Additional Program Benefits',
                            subtitle: '',
                            layoutType: 'CARDS',
                            placement: 'AFTER_CURRICULUM',
                            isVisible: true,
                            items: [{ title: 'New Highlight Item', description: '' }],
                          },
                        ],
                      },
                    }))
                  }
                  className="px-3.5 py-2 rounded-xl border border-dashed border-[#006FFF] text-[#006FFF] text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Custom Section
                </button>
              </div>

              {(data.extensibleConfig?.customSections || []).map((sec: any, sIdx: number) => (
                <div key={sec.id || sIdx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#006FFF]">Custom Section #{sIdx + 1}</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sec.isVisible !== false}
                          onChange={(e) => {
                            const list = [...(data.extensibleConfig?.customSections || [])];
                            list[sIdx] = { ...list[sIdx], isVisible: e.target.checked };
                            setData((prev: any) => ({
                              ...prev,
                              extensibleConfig: { ...prev.extensibleConfig, customSections: list },
                            }));
                          }}
                        />
                        Visible
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const list = (data.extensibleConfig?.customSections || []).filter((_: any, i: number) => i !== sIdx);
                          setData((prev: any) => ({
                            ...prev,
                            extensibleConfig: { ...prev.extensibleConfig, customSections: list },
                          }));
                        }}
                        className="text-rose-500 text-xs font-semibold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) => {
                        const list = [...(data.extensibleConfig?.customSections || [])];
                        list[sIdx] = { ...list[sIdx], title: e.target.value };
                        setData((prev: any) => ({
                          ...prev,
                          extensibleConfig: { ...prev.extensibleConfig, customSections: list },
                        }));
                      }}
                      placeholder="Section Title"
                      className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-bold"
                    />
                    <select
                      value={sec.layoutType || 'CARDS'}
                      onChange={(e) => {
                        const list = [...(data.extensibleConfig?.customSections || [])];
                        list[sIdx] = { ...list[sIdx], layoutType: e.target.value };
                        setData((prev: any) => ({
                          ...prev,
                          extensibleConfig: { ...prev.extensibleConfig, customSections: list },
                        }));
                      }}
                      className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs"
                    >
                      <option value="CARDS">Cards Grid</option>
                      <option value="BULLETS">Bullet Points</option>
                      <option value="METRICS">Metrics / Stats</option>
                      <option value="RESOURCES">Downloadable Resources</option>
                      <option value="CTA">Call To Action</option>
                    </select>
                    <select
                      value={sec.placement || 'AFTER_CURRICULUM'}
                      onChange={(e) => {
                        const list = [...(data.extensibleConfig?.customSections || [])];
                        list[sIdx] = { ...list[sIdx], placement: e.target.value };
                        setData((prev: any) => ({
                          ...prev,
                          extensibleConfig: { ...prev.extensibleConfig, customSections: list },
                        }));
                      }}
                      className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs"
                    >
                      <option value="OVERVIEW">Overview Area</option>
                      <option value="AFTER_HIGHLIGHTS">After Highlights</option>
                      <option value="AFTER_CURRICULUM">After Curriculum</option>
                      <option value="SIDEBAR">Sidebar</option>
                    </select>
                  </div>

                  <div className="space-y-2 pl-3 border-l-2 border-blue-200">
                    {(sec.items || []).map((item: any, iIdx: number) => (
                      <div key={iIdx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-slate-200">
                        <input
                          type="text"
                          value={item.title || ''}
                          onChange={(e) => {
                            const list = [...(data.extensibleConfig?.customSections || [])];
                            const items = [...(list[sIdx].items || [])];
                            items[iIdx] = { ...items[iIdx], title: e.target.value };
                            list[sIdx] = { ...list[sIdx], items };
                            setData((prev: any) => ({
                              ...prev,
                              extensibleConfig: { ...prev.extensibleConfig, customSections: list },
                            }));
                          }}
                          placeholder="Item Title"
                          className="sm:col-span-4 px-2 py-1 rounded border border-slate-200 text-xs font-semibold"
                        />
                        <input
                          type="text"
                          value={item.description || ''}
                          onChange={(e) => {
                            const list = [...(data.extensibleConfig?.customSections || [])];
                            const items = [...(list[sIdx].items || [])];
                            items[iIdx] = { ...items[iIdx], description: e.target.value };
                            list[sIdx] = { ...list[sIdx], items };
                            setData((prev: any) => ({
                              ...prev,
                              extensibleConfig: { ...prev.extensibleConfig, customSections: list },
                            }));
                          }}
                          placeholder="Description..."
                          className="sm:col-span-7 px-2 py-1 rounded border border-slate-200 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const list = [...(data.extensibleConfig?.customSections || [])];
                            const items = (list[sIdx].items || []).filter((_: any, j: number) => j !== iIdx);
                            list[sIdx] = { ...list[sIdx], items };
                            setData((prev: any) => ({
                              ...prev,
                              extensibleConfig: { ...prev.extensibleConfig, customSections: list },
                            }));
                          }}
                          className="sm:col-span-1 text-rose-500 flex justify-end p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const list = [...(data.extensibleConfig?.customSections || [])];
                        list[sIdx] = {
                          ...list[sIdx],
                          items: [...(list[sIdx].items || []), { title: '', description: '' }],
                        };
                        setData((prev: any) => ({
                          ...prev,
                          extensibleConfig: { ...prev.extensibleConfig, customSections: list },
                        }));
                      }}
                      className="text-[11px] font-bold text-[#006FFF] hover:underline"
                    >
                      + Add Section Item
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0 || isSaving}
          className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 text-xs font-bold flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" /> Previous Step
        </button>

        {currentStep === STEPS.length - 1 ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || !data.title?.trim()}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-md transition"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEditMode ? 'Finish & Update Course' : 'Finish & Save Course'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={currentStep === 0 && !data.title?.trim()}
            className="px-6 py-2.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition"
          >
            Next: {STEPS[currentStep + 1]} <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default CourseWizard;
