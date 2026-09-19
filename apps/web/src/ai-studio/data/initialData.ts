import { DiscoveryData, StepMeta, ClientProject } from '../types';

export const STEPS_CONFIG: StepMeta[] = [
  {
    number: 1,
    id: 'identity',
    title: 'זהות העסק',
    subtitle: 'פרטי הבסיס והסיפור שמניע אתכם',
    iconName: 'Building2',
    estimatedMinutes: 2,
  },
  {
    number: 2,
    id: 'customers',
    title: 'קהל הלקוחות',
    subtitle: 'הבנת הצרכים, החששות והרצונות של הלקוח',
    iconName: 'Users',
    estimatedMinutes: 2,
  },
  {
    number: 3,
    id: 'services',
    title: 'שירותים ומוצרים',
    subtitle: 'הערך והפתרונות שאתם מעניקים',
    iconName: 'Layers',
    estimatedMinutes: 3,
  },
  {
    number: 4,
    id: 'advantage',
    title: 'יתרון תחרותי',
    subtitle: 'הייחודיות, ההבטחות וההוכחות בשטח',
    iconName: 'Sparkles',
    estimatedMinutes: 2,
  },
  {
    number: 5,
    id: 'brand',
    title: 'מיתוג ועיצוב',
    subtitle: 'שפה חזותית, צבעים וסגנון רצוי',
    iconName: 'Palette',
    estimatedMinutes: 2,
  },
  {
    number: 6,
    id: 'uploads',
    title: 'חומרי גלם וקבצים',
    subtitle: 'לוגו, תמונות, תעודות ומסמכים',
    iconName: 'UploadCloud',
    estimatedMinutes: 2,
  },
  {
    number: 7,
    id: 'technical',
    title: 'נוכחות ודיגיטל',
    subtitle: 'דומיין, רשתות חברתיות ופרטי התקשרות',
    iconName: 'Globe',
    estimatedMinutes: 1,
  },
  {
    number: 8,
    id: 'review',
    title: 'סקירה ואישור',
    subtitle: 'מבט כולל על כל מה ששותף',
    iconName: 'CheckCircle2',
    estimatedMinutes: 1,
  },
  {
    number: 9,
    id: 'completion',
    title: 'סיום והתחלת בנייה',
    subtitle: 'העברת המידע לצוות PageLoom',
    iconName: 'Rocket',
    estimatedMinutes: 1,
  },
];

export const BUSINESS_CATEGORIES = [
  'שירותים מקצועיים (עריכת דין, ראיית חשבון, ייעוץ)',
  'בעלי מקצוע ובנייה (שיפוצים, אינסטלציה, חשמל)',
  'בריאות, טיפול ואימון (פסיכותרפיה, פיזיותרפיה, כושר)',
  'יופי ואסתטיקה (קוסמטיקה, מספרה, טיפוח)',
  'חנויות ומסחר (מסחר אלקטרוני, חנויות פיזיות)',
  'מזון, קולינריה ומסעדנות',
  'חינוך, הדרכה וקורסים',
  'טכנולוגיה, תוכנה ודיגיטל',
  'נדל״ן ושיווק נכסים',
  'אירועים והפקות',
  'אחר',
];

export const BRAND_STYLE_PRESETS = [
  {
    id: 'modern_minimal',
    title: 'מודרני ומינימליסטי',
    subtitle: 'קווים נקיים, המון רווח לבן, אלגנטיות מאופקת',
    primaryPreview: '#0f172a',
    secondaryPreview: '#3b82f6',
    vibe: 'נקי, יוקרתי, חדשני',
    imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80',
    tags: ['הייטק', 'דיוק', 'רווח לבן'],
  },
  {
    id: 'warm_friendly',
    title: 'חם ומזמין',
    subtitle: 'גוונים טבעיים, תחושה אישית, נגישות ואמינות',
    primaryPreview: '#78350f',
    secondaryPreview: '#d97706',
    vibe: 'משפחתי, אכפתי, קרוב',
    imageUrl: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80',
    tags: ['חום', 'אמינות', 'אישי'],
  },
  {
    id: 'luxury_prestige',
    title: 'פרימיום ויוקרתי',
    subtitle: 'צבעי עומק עשירים, תחושת בלעדיות ומעמד גבוה',
    primaryPreview: '#1e1b4b',
    secondaryPreview: '#c084fc',
    vibe: 'אקסקלוסיבי, סמכותי, יוקרתי',
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
    tags: ['יוקרה', 'בלעדיות', 'אלגנטיות'],
  },
  {
    id: 'bold_dynamic',
    title: 'צעיר ודינמי',
    subtitle: 'צבעים עזים, ניגודיות חזקה, מושך תשומת לב',
    primaryPreview: '#052e16',
    secondaryPreview: '#10b981',
    vibe: 'אנרגטי, מתקדם, בולט',
    imageUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=600&q=80',
    tags: ['אנרגטי', 'נועז', 'חדשני'],
  },
  {
    id: 'natural_organic',
    title: 'טבעי ואורגני',
    subtitle: 'גווני אדמה וירוק, רוגע, אותנטיות ובריאות',
    primaryPreview: '#14532d',
    secondaryPreview: '#84cc16',
    vibe: 'בריא, אקולוגי, שקט',
    imageUrl: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=600&q=80',
    tags: ['טבעי', 'רוגע', 'אורגני'],
  },
  {
    id: 'corporate_trust',
    title: 'סמכותי ומקצועי',
    subtitle: 'גווני כחול ופחם, יציבות, ביטחון ועוצמה',
    primaryPreview: '#1e3a8a',
    secondaryPreview: '#0284c7',
    vibe: 'אמין, מבוסס, מנוסה',
    imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
    tags: ['עסקי', 'יציבות', 'ביטחון'],
  },
];

export const COLOR_PALETTES = [
  {
    name: 'כחול עמוק וציאן מודרני',
    primary: '#1E293B',
    secondary: '#2563EB',
    primaryName: 'פחם עמוק',
    secondaryName: 'כחול אלקטריק',
  },
  {
    name: 'אינדיגו פרימיום וסגול עדין',
    primary: '#312E81',
    secondary: '#8B5CF6',
    primaryName: 'אינדיגו עמוק',
    secondaryName: 'סגול חי',
  },
  {
    name: 'ירוק יער ואמרלד רענן',
    primary: '#064E3B',
    secondary: '#10B981',
    primaryName: 'ירוק יער',
    secondaryName: 'אמרלד',
  },
  {
    name: 'שחור מט וזהב חם',
    primary: '#18181B',
    secondary: '#D97706',
    primaryName: 'שחור מט',
    secondaryName: 'ברונזה / זהב',
  },
  {
    name: 'טורקיז ים ואפור אלגנטי',
    primary: '#134E4A',
    secondary: '#0D9488',
    primaryName: 'ירוק-ים כהה',
    secondaryName: 'טורקיז עשיר',
  },
  {
    name: 'אדום יין וקורל מודרני',
    primary: '#450A0A',
    secondary: '#EF4444',
    primaryName: 'בורדו עמוק',
    secondaryName: 'קורל חי',
  },
];

export const PERSONALITY_TRAITS = [
  'מקצועי וסמכותי',
  'חם ונגיש',
  'חדשני והייטקיסטי',
  'יוקרתי ואקסקלוסיבי',
  'אישי ומלווה בגובה העיניים',
  'מהיר וממוקד תוצאות',
  'אמין ושקוף ב-100%',
  'יצירתי ומחוץ לקופסה',
];

export const INITIAL_DISCOVERY_DATA: DiscoveryData = {
  // Step 1: Business Identity
  businessName: '',
  ownerName: '',
  email: '',
  phone: '',
  whatsapp: '',
  businessCategory: '',
  businessStory: '',
  yearsInBusiness: '',
  location: '',
  tagline: '',

  // Step 2: Customers
  idealCustomer: '',
  customerProblem: '',
  customerDesire: '',
  customerFears: '',
  customerObstacles: '',

  // Step 3: Services
  services: [
    {
      id: 'srv-1',
      name: '',
      problemSolved: '',
      resultReceived: '',
      whyValuable: '',
      priceEstimate: '',
    },
  ],

  // Step 4: Competitive Advantage
  whyChooseYou: '',
  uniqueDifferentiator: '',
  corePromises: '',
  socialProof: '',
  experienceSummary: '',
  guarantees: '',
  awardsAndCertifications: '',

  // Step 5: Brand
  brandStyle: 'modern_minimal',
  brandColors: {
    primary: '#1E293B',
    secondary: '#2563EB',
    primaryName: 'פחם עמוק',
    secondaryName: 'כחול עמוק',
  },
  logoStatus: 'has_logo',
  fontStyle: 'נקי וקריא (סנס-סריף מודרני)',
  inspirationWebsites: '',
  brandPersonality: ['מקצועי וסמכותי', 'אמין ושקוף ב-100%'],

  // Step 6: Uploads
  uploadedFiles: [],

  // Step 7: Technical
  hasExistingDomain: null,
  existingDomain: '',
  needsDomainHelp: false,
  facebookUrl: '',
  instagramUrl: '',
  businessEmail: '',
  openingHours: 'א׳-ה׳: 08:30 - 18:00',
  physicalAddress: '',
  googleMapsUrl: '',
  tiktokOrLinkedIn: '',

  // Meta & Status
  currentStep: 0, // 0 = landing screen
  completedSteps: [],
  isCompleted: false,
  lastUpdated: new Date().toISOString(),
  projectId: '',
  customerId: 'cust-101',
};

// No fake sample projects in production database
export const SAMPLE_PROJECTS: ClientProject[] = [];
