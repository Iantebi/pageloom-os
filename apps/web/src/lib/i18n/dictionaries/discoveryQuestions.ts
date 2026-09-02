import type { DiscoverySectionId } from "@pageloom/core";

// Copy for Business Discovery ("אפיון העסק") — deliberately separate from
// packages/core/src/discovery-template.ts, which owns structure/validation only. See
// docs/customer-discovery-onboarding/DATA-MODEL.md §3.2 for why copy and structure are split.
// Every question's copy lives here, keyed by the exact question id from discoveryTemplate.

export type QuestionCopy = { label: string; whyWeAsk?: string; helpText?: string; placeholder?: string };
type SectionCopy = { title: string; description: string };

const sectionsHe: Record<DiscoverySectionId, SectionCopy> = {
  business: { title: "היכרות עם העסק", description: "בואו נכיר את העסק שלכם — מי אתם ומה חשוב לכם." },
  customers: { title: "הלקוחות שלכם", description: "ספרו לנו על הלקוחות שאתם הכי אוהבים לעבוד איתם." },
  services: { title: "השירותים שלכם", description: "אילו שירותים או מוצרים אתם מציעים?" },
  differentiation: { title: "למה בוחרים בכם", description: "מה גורם ללקוחות לבחור דווקא בכם?" },
  trust: { title: "אמון והמלצות", description: "כל דבר שמראה ללקוחות חדשים שאפשר לסמוך עליכם." },
  branding: { title: "מיתוג וסגנון", description: "איך תרצו שהעסק שלכם ייראה וירגיש?" },
  materials: { title: "חומרים ותמונות", description: "תמונות וקבצים שיעזרו לנו להציג את העסק שלכם נכון." },
  presence: { title: "פרטי העסק והנוכחות הדיגיטלית", description: "איך לקוחות יוצרים איתכם קשר?" },
  goals: { title: "המטרה והסיום", description: "מה ההצלחה תיראה בעיניכם?" },
};

const sectionsEn: Record<DiscoverySectionId, SectionCopy> = {
  business: { title: "Getting to know your business", description: "Let's understand who you are and what matters to you." },
  customers: { title: "Your customers", description: "Tell us about the customers you love working with." },
  services: { title: "Your services", description: "What services or products do you offer?" },
  differentiation: { title: "Why customers choose you", description: "What makes customers pick you specifically?" },
  trust: { title: "Trust & social proof", description: "Anything that shows new customers they can trust you." },
  branding: { title: "Branding & style", description: "How should your business look and feel?" },
  materials: { title: "Materials & photos", description: "Photos and files that help us present your business well." },
  presence: { title: "Business info & digital presence", description: "How do customers get in touch with you?" },
  goals: { title: "Your goal", description: "What would success look like?" },
};

const questionsHe: Record<string, QuestionCopy> = {
  "business.publicName": { label: "שם העסק כפי שיופיע באתר" },
  "business.whatItDoes": { label: "מה העסק שלכם עושה?", whyWeAsk: "כדי שנוכל להסביר את העסק שלכם בצורה ברורה, בדיוק כמו שהייתם מסבירים ללקוח חדש.", placeholder: "תארו את זה כאילו אתם מסבירים ללקוח חדש שפוגש אתכם בפעם הראשונה." },
  "business.story": { label: "למה התחלתם את העסק?", helpText: "לא חובה, אבל סיפור טוב בונה אמון." },
  "business.founderPriorities": { label: "מה הכי חשוב לכם בעבודה שלכם?" },
  "business.customerFeeling": { label: "מה תרצו שלקוחות ירגישו כשהם עובדים איתכם?", whyWeAsk: "התחושה שאתם רוצים ליצור עוזרת לנו לבחור את הטון והעיצוב הנכונים." },

  "customers.idealCustomer": { label: "מי הלקוח האידיאלי שלכם?", whyWeAsk: "חשבו על לקוח טוב שהיה לכם בעבר והייתם שמחים לקבל עוד 20 לקוחות כמוהו.", placeholder: "תארו אותו: מי הוא, מה מצבו, מה הוא מחפש." },
  "customers.beforeContact": { label: "מה קורה ללקוח רגע לפני שהוא פונה אליכם?", whyWeAsk: "ככל שנבין טוב יותר את הרגע שבו לקוח מחליט לפנות אליכם, נוכל לבנות דף שמדבר בדיוק אליו." },
  "customers.realProblem": { label: "מה הבעיה האמיתית שאיתה הלקוח מגיע?" },
  "customers.desiredOutcome": { label: "מה הלקוח רוצה להשיג?" },
  "customers.commonFears": { label: "מה החששות הכי נפוצים של לקוחות לפני שהם פונים אליכם?" },
  "customers.ifUnsolved": { label: "מה קורה ללקוח אם הבעיה שלו לא נפתרת?" },

  "services.list": { label: "השירותים או המוצרים שלכם", whyWeAsk: "כל שירות שתוסיפו יכול להפוך לחלק באתר שמושך את הלקוחות הנכונים." },
  "services.name": { label: "שם השירות" },
  "services.forWhom": { label: "למי זה מיועד?" },
  "services.problem": { label: "איזו בעיה זה פותר?" },
  "services.outcome": { label: "מה הלקוח מקבל בסוף?" },
  "services.priceLabel": { label: "טווח מחיר (לא חובה)" },
  "services.promote": { label: "להדגיש שירות זה באתר?" },
  "services.add": { label: "הוספת שירות" },
  "services.remove": { label: "הסרה" },

  "differentiation.whyCustomersChoseYou": { label: "למה לקוחות בוחרים דווקא בכם?", whyWeAsk: "תשובות כלליות כמו \"אנחנו הכי מקצועיים\" פחות עוזרות — נסו לחשוב על משהו קונקרטי וייחודי." },
  "differentiation.whatCustomersSay": { label: "מה לקוחות אומרים עליכם בפועל?" },
  "differentiation.processAdvantages": { label: "מה בדרך שבה אתם עובדים שונה או טוב יותר?" },
  "differentiation.other": { label: "משהו נוסף שחשוב שנדע?" },

  "trust.hasTestimonials": { label: "יש לכם המלצות מלקוחות?" },
  "trust.testimonials": { label: "שתפו את ההמלצות שיש לכם", helpText: "אפשר להעלות צילום מסך, או פשוט להעתיק את הטקסט." },
  "trust.wantsHelpCollecting": { label: "תרצו שנעזור לכם לאסוף המלצות מלקוחות?" },
  "trust.yearsExperience": { label: "כמה שנות ניסיון יש לכם?" },
  "trust.clientCount": { label: "כמה לקוחות שירתתם עד היום?" },
  "trust.certifications": { label: "יש לכם הסמכות, תעודות או הישגים שכדאי להציג?" },

  "branding.hasLogo": { label: "יש לכם לוגו קיים?" },
  "branding.logo": { label: "העלאת הלוגו" },
  "branding.colors": { label: "בחרו עד שני צבעים מובילים למותג שלכם", whyWeAsk: "הצבעים שתבחרו ישפיעו על כל העיצוב של האתר." },
  "branding.style": { label: "איזה סגנון הכי מתאים לעסק שלכם?" },
  "branding.avoid": { label: "יש משהו שבטוח לא תרצו?" },

  "materials.ownerPhotos": { label: "תמונות שלכם" },
  "materials.teamPhotos": { label: "תמונות של הצוות" },
  "materials.locationPhotos": { label: "תמונות של המקום" },
  "materials.productPhotos": { label: "תמונות של המוצרים או העבודות שלכם" },
  "materials.priceListOrBrochure": { label: "מחירון או חוברת (אם יש)" },

  "presence.phone": { label: "מספר טלפון" },
  "presence.whatsapp": { label: "מספר וואטסאפ" },
  "presence.email": { label: "כתובת אימייל" },
  "presence.address": { label: "כתובת העסק" },
  "presence.hours": { label: "שעות פעילות" },
  "presence.serviceAreas": { label: "אזורי שירות" },
  "presence.hasWebsite": { label: "יש לכם כבר אתר קיים?" },
  "presence.existingWebsiteUrl": { label: "קישור לאתר הקיים" },
  "presence.hasDomain": { label: "יש לכם כבר דומיין (כתובת אינטרנט)?" },
  "presence.socialLinks": { label: "קישורים לרשתות חברתיות" },
  "presence.googleBusinessUrl": { label: "קישור לעסק שלכם בגוגל" },

  "goals.biggestProblem": { label: "מה הבעיה הגדולה ביותר שתרצו שנפתור?" },
  "goals.sixMonthSuccess": { label: "דמיינו שבעוד חצי שנה הפרויקט הצליח מאוד — מה השתנה בעסק שלכם?", whyWeAsk: "זה עוזר לנו להבין איך נראית הצלחה מבחינתכם, ולא רק מבחינתנו." },
  "goals.priorityOutcomes": { label: "מה הכי חשוב לכם להשיג?" },
  "goals.capacityCheck": { label: "אם תקבלו פי שלושה פניות מחר — תוכלו לטפל בהן?", whyWeAsk: "אנחנו רוצים לוודא שהאתר מביא לכם לקוחות שאתם באמת יכולים לשרת." },
};

const questionsEn: Record<string, QuestionCopy> = {
  "business.publicName": { label: "Business name as it should appear on the site" },
  "business.whatItDoes": { label: "What does your business do?", whyWeAsk: "So we can explain your business clearly, the way you'd explain it to a new customer.", placeholder: "Describe it as if explaining to a new customer meeting you for the first time." },
  "business.story": { label: "Why did you start the business?", helpText: "Optional, but a good story builds trust." },
  "business.founderPriorities": { label: "What matters most to you in your work?" },
  "business.customerFeeling": { label: "What should customers feel when working with you?", whyWeAsk: "The feeling you want to create helps us choose the right tone and design." },

  "customers.idealCustomer": { label: "Who is your ideal customer?", whyWeAsk: "Think of a great customer you've had and would love 20 more just like them.", placeholder: "Describe them: who they are, their situation, what they're looking for." },
  "customers.beforeContact": { label: "What's happening for a customer right before they contact you?", whyWeAsk: "The better we understand that moment, the better we can speak directly to it." },
  "customers.realProblem": { label: "What's the real problem the customer comes to you with?" },
  "customers.desiredOutcome": { label: "What does the customer want to achieve?" },
  "customers.commonFears": { label: "What are customers' most common worries before reaching out?" },
  "customers.ifUnsolved": { label: "What happens to the customer if the problem stays unsolved?" },

  "services.list": { label: "Your services or products", whyWeAsk: "Every service you add can become part of a page that attracts the right customers." },
  "services.name": { label: "Service name" },
  "services.forWhom": { label: "Who is it for?" },
  "services.problem": { label: "What problem does it solve?" },
  "services.outcome": { label: "What does the customer get in the end?" },
  "services.priceLabel": { label: "Price range (optional)" },
  "services.promote": { label: "Highlight this service on the site?" },
  "services.add": { label: "Add a service" },
  "services.remove": { label: "Remove" },

  "differentiation.whyCustomersChoseYou": { label: "Why do customers choose you specifically?", whyWeAsk: "Generic answers like \"we're the most professional\" help less — try to think of something concrete and specific." },
  "differentiation.whatCustomersSay": { label: "What do customers actually say about you?" },
  "differentiation.processAdvantages": { label: "What's different or better about how you work?" },
  "differentiation.other": { label: "Anything else we should know?" },

  "trust.hasTestimonials": { label: "Do you have testimonials from customers?" },
  "trust.testimonials": { label: "Share the testimonials you have", helpText: "A screenshot works, or just paste the text." },
  "trust.wantsHelpCollecting": { label: "Would you like help collecting testimonials?" },
  "trust.yearsExperience": { label: "How many years of experience do you have?" },
  "trust.clientCount": { label: "How many customers have you served so far?" },
  "trust.certifications": { label: "Any certifications or achievements worth showing?" },

  "branding.hasLogo": { label: "Do you already have a logo?" },
  "branding.logo": { label: "Upload your logo" },
  "branding.colors": { label: "Pick up to two main brand colors", whyWeAsk: "The colors you choose shape the entire look of the site." },
  "branding.style": { label: "Which style fits your business best?" },
  "branding.avoid": { label: "Anything you definitely don't want?" },

  "materials.ownerPhotos": { label: "Photos of you" },
  "materials.teamPhotos": { label: "Team photos" },
  "materials.locationPhotos": { label: "Photos of your location" },
  "materials.productPhotos": { label: "Photos of your products or work" },
  "materials.priceListOrBrochure": { label: "Price list or brochure (if any)" },

  "presence.phone": { label: "Phone number" },
  "presence.whatsapp": { label: "WhatsApp number" },
  "presence.email": { label: "Email address" },
  "presence.address": { label: "Business address" },
  "presence.hours": { label: "Opening hours" },
  "presence.serviceAreas": { label: "Service areas" },
  "presence.hasWebsite": { label: "Do you already have a website?" },
  "presence.existingWebsiteUrl": { label: "Link to your existing website" },
  "presence.hasDomain": { label: "Do you already own a domain?" },
  "presence.socialLinks": { label: "Social media links" },
  "presence.googleBusinessUrl": { label: "Link to your Google Business profile" },

  "goals.biggestProblem": { label: "What's the biggest problem you'd like us to solve?" },
  "goals.sixMonthSuccess": { label: "Imagine that six months from now this project succeeded — what changed in your business?", whyWeAsk: "This helps us understand what success looks like to you, not just to us." },
  "goals.priorityOutcomes": { label: "What matters most for you to achieve?" },
  "goals.capacityCheck": { label: "If you got three times more inquiries tomorrow, could you handle them?", whyWeAsk: "We want to make sure the site brings you customers you can actually serve well." },
};

// Display labels for opaque option keys stored in discovery-template.ts (select/multi_select/color_pair).
const optionLabelsHe: Record<string, string> = {
  availability: "זמינות", speed: "מהירות", personal_service: "שירות אישי", methodology: "שיטת עבודה", guarantees: "אחריות/הבטחות", transparency: "שקיפות", after_service: "שירות לאחר המכירה", expertise: "מומחיות", certifications: "הסמכות",
  blue: "כחול", black: "שחור", white: "לבן", green: "ירוק", gold: "זהב", beige: "בז'", grey: "אפור", custom: "צבע מותאם אישית",
  modern: "מודרני", premium: "יוקרתי", clean_minimal: "נקי ומינימליסטי", warm_friendly: "חם וידידותי", young_dynamic: "צעיר ודינמי", professional: "מקצועי", innovative: "חדשני", calm: "רגוע",
  more_inquiries: "יותר פניות", better_leads: "לידים איכותיים יותר", more_customers: "יותר לקוחות", more_sales: "יותר מכירות", more_trust: "יותר אמון", better_google_visibility: "נראות טובה יותר בגוגל", easier_bookings: "תיאום פגישות קל יותר", less_manual_work: "פחות עבודה ידנית", better_follow_up: "מעקב טוב יותר אחרי לידים", better_digital_presence: "נוכחות דיגיטלית טובה יותר",
};
const optionLabelsEn: Record<string, string> = {
  availability: "Availability", speed: "Speed", personal_service: "Personal service", methodology: "Methodology", guarantees: "Guarantees", transparency: "Transparency", after_service: "After-service", expertise: "Expertise", certifications: "Certifications",
  blue: "Blue", black: "Black", white: "White", green: "Green", gold: "Gold", beige: "Beige", grey: "Grey", custom: "Custom color",
  modern: "Modern", premium: "Premium", clean_minimal: "Clean & minimal", warm_friendly: "Warm & friendly", young_dynamic: "Young & dynamic", professional: "Professional", innovative: "Innovative", calm: "Calm",
  more_inquiries: "More inquiries", better_leads: "Better leads", more_customers: "More customers", more_sales: "More sales", more_trust: "More trust", better_google_visibility: "Better Google visibility", easier_bookings: "Easier bookings", less_manual_work: "Less manual work", better_follow_up: "Better lead follow-up", better_digital_presence: "Better digital presence",
};

const swatchHexHe: Record<string, string> = { blue: "#2563eb", black: "#111111", white: "#f5f5f5", green: "#16a34a", gold: "#b8860b", beige: "#e8dcc8", grey: "#9ca3af" };

export const discoveryQuestions = {
  he: { sections: sectionsHe, questions: questionsHe, options: optionLabelsHe, swatchHex: swatchHexHe },
  en: { sections: sectionsEn, questions: questionsEn, options: optionLabelsEn, swatchHex: swatchHexHe },
} as const;
