import { DiscoveryData } from '../types';

export interface AiGeneratedAssets {
  businessSummary: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroCta: string;
  valueProps: { title: string; desc: string }[];
  servicesCopy: { title: string; problem: string; solution: string; benefit: string; price?: string }[];
  faqItems: { question: string; answer: string }[];
  seoPackage: {
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
    schemaJson: string;
  };
  copywritingBrief: string;
  landingPagePrompt: string;
}

export function generateAiAssets(data: DiscoveryData): AiGeneratedAssets {
  const businessName = data.businessName || 'העסק';
  const ownerName = data.ownerName || 'בעל העסק';
  const category = data.businessCategory || 'שירותים מקצועיים';
  const location = data.location || 'ישראל';
  const years = data.yearsInBusiness || 'שנים רבות';

  // Hero Headline & Sub
  const heroHeadline = data.tagline || `${businessName} – ${data.uniqueDifferentiator || 'פתרונות מובילים בהתאמה אישית'}`;
  const heroSubheadline = data.customerProblem && data.customerDesire
    ? `נמאס לכם מ-${data.customerProblem}? אנחנו מעניקים לכם ${data.customerDesire} עם שקט נפשי מלא וליווי אישי.`
    : `הדרך הבטוחה והמקצועית להשגת התוצאות הטובות ביותר, עם מעל ${years} של ניסיון והוכחות בשטח.`;

  const heroCta = 'לשיחת ייעוץ ותיאום ללא התחייבות ←';

  // Value props derived from advantages
  const valueProps = [
    {
      title: 'למה דווקא אנחנו',
      desc: data.whyChooseYou || 'מקצועיות בלתי מתפשרת, שירות אישי ומוכח עם מאות לקוחות מרוצים.',
    },
    {
      title: 'הייחודיות שלנו',
      desc: data.uniqueDifferentiator || 'פתרונות מתקדמים ושיטות עבודה ייחודיות המותאמות בדיוק לצרכים שלכם.',
    },
    {
      title: 'ההתחייבות שלנו',
      desc: data.corePromises || 'עמידה בלוחות זמנים, שקיפות מלאה ואחריות מקיפה על כל שירות.',
    },
    {
      title: 'הוכחות בשטח',
      desc: data.socialProof || data.experienceSummary || `${years} של מוניטין מקצועי וליווי צמוד.`,
    },
  ];

  // Services formatted
  const servicesCopy = data.services
    .filter((s) => s.name.trim().length > 0)
    .map((s) => ({
      title: s.name,
      problem: s.problemSolved || 'אתגרים מורכבים הדורשים טיפול מקצועי',
      solution: s.resultReceived || 'פתרון מקיף, מדויק ואיכותי',
      benefit: s.whyValuable || 'חיסכון משמעותי בזמן, כסף ומשאבים',
      price: s.priceEstimate || undefined,
    }));

  // FAQ items derived from fears & obstacles
  const faqItems = [
    {
      question: `מה מבטיח לי תוצאות בעבודה עם ${businessName}?`,
      answer: data.guarantees || data.corePromises || 'אנו מעניקים אחריות מלאה על עבודתנו, ומקפידים על תיאום ציפיות ושקיפות לאורך כל הדרך.',
    },
    {
      question: data.customerFears ? `אני חושש/ת ש-${data.customerFears}, כיצד אתם מתמודדים עם זה?` : 'איך מתבצע תהליך העבודה מולכם?',
      answer: `ב-${businessName} אנו מכירים היטב את האתגר הזה. לכן בנינו תהליך עבודה סדור, מבוקר ואישי המבטיח ביטחון מלא ושליטה בכל שלב.`,
    },
    {
      question: 'כמה זמן לוקח התהליך ומה נדרש ממני?',
      answer: 'אנו דואגים לעשות את מירב העבודה עבורכם. לאחר אפיון קצר ומהיר, הצוות שלנו מוביל את הביצוע עד למסירת התוצאה המושלמת.',
    },
  ];

  // SEO Package
  const metaTitle = `${businessName} | ${category} ב${location} | שירות מקצועי`;
  const metaDescription = `${businessName} בהנהלת ${ownerName}. ${data.customerProblem ? `פתרון מקיף ל${data.customerProblem}.` : ''} ${data.corePromises || 'שירות אמין, מהיר ומקצועי'}. לפרטים ושיחת ייעוץ: ${data.phone || ''}`.trim();
  
  const keywords = [
    businessName,
    category,
    location,
    ...data.services.map((s) => s.name).filter(Boolean),
    'שירות מקצועי',
    'המלצות',
    'מחיר',
  ];

  const schemaJson = JSON.stringify(
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: businessName,
      description: metaDescription,
      telephone: data.phone || data.whatsapp,
      email: data.businessEmail || data.email,
      address: {
        '@type': 'PostalAddress',
        streetAddress: data.physicalAddress,
        addressLocality: location,
        addressCountry: 'IL',
      },
      openingHours: data.openingHours,
    },
    null,
    2
  );

  // Deep Summary
  const businessSummary = `
📌 פרופיל עסקי מלא – ${businessName}
=======================================
• בעלים: ${ownerName} | טלפון/וואטסאפ: ${data.phone || data.whatsapp} | אימייל: ${data.email}
• תחום: ${category} | שנות פעילות: ${years} | אזור שירות: ${location}
• סיפור העסק והחזון:
  ${data.businessStory || 'לא צוין'}

🎯 קהל יעד ופסיכולוגיית לקוח:
• לקוח אידיאלי: ${data.idealCustomer || 'לא צוין'}
• הכאב/הבעיה המרכזית: ${data.customerProblem || 'לא צוין'}
• התוצאה הנחשקת: ${data.customerDesire || 'לא צוין'}
• חסמים ופחדים: ${data.customerFears || 'לא צוין'} | גורם מעכב: ${data.customerObstacles || 'לא צוין'}

💎 יתרון תחרותי והבטחות מפתח:
• למה לבחור בעסק: ${data.whyChooseYou || 'לא צוין'}
• בידול ייחודי: ${data.uniqueDifferentiator || 'לא צוין'}
• הבטחות ליבה: ${data.corePromises || 'לא צוין'}
• הוכחות חברתיות: ${data.socialProof || 'לא צוין'}
• אחריות ובטחונות: ${data.guarantees || 'לא צוין'}

🎨 שפה מיתוגית:
• סגנון: ${data.brandStyle} | אישיות: ${data.brandPersonality.join(', ')}
• צבעים: ראשי (${data.brandColors.primary}) | משני (${data.brandColors.secondary})
• פונטים: ${data.fontStyle}
  `.trim();

  // Full LLM generation prompt ready for Gemini / Web builders
  const landingPagePrompt = `
You are PageLoom's Principal Web Architect & Direct-Response Copywriter.
Create an ultra-high converting, modern Hebrew landing page for the following business:

BUSINESS: ${businessName} (${category})
OWNER: ${ownerName} (${years} experience in ${location})
CORE VALUE PROP: ${data.uniqueDifferentiator || data.whyChooseYou}
TARGET AUDIENCE: ${data.idealCustomer}
CUSTOMER PAIN POINT: ${data.customerProblem}
PROMISED OUTCOME: ${data.customerDesire}
SERVICES TO SHOWCASE: ${JSON.stringify(servicesCopy)}
BRAND VIBE: ${data.brandStyle} (${data.brandPersonality.join(', ')})
COLOR SCHEME: Primary ${data.brandColors.primary}, Secondary ${data.brandColors.secondary}
CONTACT: ${data.phone || data.whatsapp}, Email: ${data.email}

Write compelling, conversational, benefit-driven Hebrew copy with hero, social proof triggers, interactive service cards, FAQ accordion, and clear WhatsApp CTA.
  `.trim();

  const copywritingBrief = `
תקציר קופירייטינג ל-PageLoom:
- טון דיבור: ${data.brandPersonality.join(', ') || 'מקצועי, חם ואמין'}
- מילים וביטויים שאסור לוותר עליהם: ${data.uniqueDifferentiator}, ${data.corePromises}
- דגש מרכזי להנעה לפעולה: להסיר את הפחד של הלקוח מ-${data.customerFears || 'אי ודאות ומחירים מנופחים'} ולהבליט את ${data.guarantees || 'האחריות והשקט הנפשי'}.
  `.trim();

  return {
    businessSummary,
    heroHeadline,
    heroSubheadline,
    heroCta,
    valueProps,
    servicesCopy,
    faqItems,
    seoPackage: {
      metaTitle,
      metaDescription,
      keywords,
      schemaJson,
    },
    copywritingBrief,
    landingPagePrompt,
  };
}
