export type Language = 'en' | 'hi';

const messages = {
  welcome: {
    en: 'Welcome to ModelWalaBot!\n\nSend me a photo of any garment and I\'ll generate professional catalog photos with AI models wearing it.\n\nJust send a photo to get started!',
    hi: 'ModelWalaBot mein aapka swagat hai!\n\nKoi bhi garment ki photo bhejo, AI model usse pehen ke catalog photo bana dega.\n\nBas ek photo bhejo aur shuru karo!',
  },
  help: {
    en: 'How to use ModelWalaBot:\n\n1. Send a garment photo (JPEG, PNG, or WebP)\n2. Wait ~15-30 seconds for your catalog photo!\n\nCommands:\n/setbackground — Choose background style\n/language — Switch language\n/start — Reset and start over\n\nYou get 2 free generations to try it out.',
    hi: 'ModelWalaBot kaise use karein:\n\n1. Garment ki photo bhejo (JPEG, PNG ya WebP)\n2. 15-30 second wait karo, catalog photo aa jayegi!\n\nCommands:\n/setbackground — Background style choose karo\n/language — Bhasha badlo\n/start — Dobara shuru karo\n\n2 free generations milti hain try karne ke liye.',
  },
  generating: {
    en: (remaining: number) => `Generating your catalog... This takes 15-30 seconds.\n(${remaining} free generation${remaining === 1 ? '' : 's'} remaining)`,
    hi: (remaining: number) => `Aapki catalog ban rahi hai... 15-30 second lagenge.\n(${remaining} free generation${remaining === 1 ? '' : 's'} baaki hai)`,
  },
  progress_download: {
    en: 'Downloading your photo...',
    hi: 'Photo download ho rahi hai...',
  },
  progress_validate: {
    en: 'Validating garment image...',
    hi: 'Garment photo check ho rahi hai...',
  },
  progress_verified: {
    en: 'Garment verified! Preparing AI model...',
    hi: 'Garment verify ho gayi! AI model taiyaar ho raha hai...',
  },
  progress_generating: {
    en: 'AI is generating your catalog photo...',
    hi: 'AI catalog photo bana raha hai...',
  },
  progress_done: {
    en: 'Done!',
    hi: 'Ho gaya!',
  },
  done: {
    en: '✅ Your catalog photo is ready!',
    hi: '✅ Aapki catalog photo taiyaar hai!',
  },
  send_photo: {
    en: 'Send me a photo of a garment to generate catalog images.',
    hi: 'Catalog banane ke liye garment ki photo bhejo.',
  },
  wait_generating: {
    en: 'Please wait — a catalog is already being generated.',
    hi: 'Thoda ruko — catalog abhi ban rahi hai.',
  },
  already_sent: {
    en: 'You already sent a photo. Wait for the result or send /start to start over.',
    hi: 'Photo pehle se bhej di hai. Result ka wait karo ya /start bhejo.',
  },
  no_credits: {
    en: 'You have used all your free generations. Contact us for more credits.',
    hi: 'Aapki free generations khatam ho gayi. Aur credits ke liye contact karo.',
  },
  not_garment: {
    en: 'This doesn\'t look like a clothing garment. Please send a photo of a shirt, pants, dress, etc.',
    hi: 'Ye garment nahi lag raha. Shirt, jeans, dress ki photo bhejo.',
  },
  invalid_image: {
    en: 'This file is not a valid image. Please send a JPEG, PNG, or WebP photo.',
    hi: 'Ye valid image nahi hai. JPEG, PNG ya WebP photo bhejo.',
  },
  download_failed: {
    en: 'Failed to download your photo. Please try again.',
    hi: 'Photo download nahi ho payi. Dobara try karo.',
  },
  generation_failed: {
    en: 'Generation failed. Your credit has been refunded. Please try again.',
    hi: 'Generation fail ho gayi. Credit wapas aa gaya hai. Dobara try karo.',
  },
  delivery_failed: {
    en: 'Your catalog was generated but delivery failed. Please try again.',
    hi: 'Catalog ban gayi but deliver nahi ho payi. Dobara try karo.',
  },
  error: {
    en: 'Sorry, something went wrong. Your credit has been refunded. Please try again.',
    hi: 'Kuch galat ho gaya. Credit wapas aa gaya hai. Dobara try karo.',
  },
  account_setup: {
    en: 'Your account is being set up. Please try again in a minute.',
    hi: 'Account setup ho raha hai. Ek minute baad try karo.',
  },
  cooldown: {
    en: 'Please wait 30 seconds between generations.',
    hi: '30 second ruko next generation ke liye.',
  },
  not_animated: {
    en: 'Please send a photo of a garment (not an animated sticker).',
    hi: 'Garment ki photo bhejo (animated sticker nahi).',
  },
  not_image: {
    en: 'Please send an image file (JPEG, PNG, or WebP).',
    hi: 'Image file bhejo (JPEG, PNG ya WebP).',
  },
  something_wrong: {
    en: 'Something went wrong. Please send a garment photo to start over.',
    hi: 'Kuch galat ho gaya. Garment ki photo bhejke dobara shuru karo.',
  },
  language_switched: {
    en: 'Language set to English.',
    hi: 'Bhasha Hinglish mein set ho gayi.',
  },
  language_choose: {
    en: 'Choose your language:',
    hi: 'Apni bhasha chuno:',
  },
  bg_current: {
    en: (label: string) => `Current background: ${label}\n\nChoose a new background:`,
    hi: (label: string) => `Abhi ka background: ${label}\n\nNaya background chuno:`,
  },
  bg_set: {
    en: (label: string) => `Background set to: ${label}\n\nNow send a garment photo to generate!`,
    hi: (label: string) => `Background set ho gaya: ${label}\n\nAb garment ki photo bhejo!`,
  },
} as const;

// Only keys that have simple string values (not functions)
type SimpleMessageKey = {
  [K in keyof typeof messages]: typeof messages[K]['en'] extends string ? K : never;
}[keyof typeof messages];

// Language preferences per chat (persists in memory)
const langPrefs = new Map<number, Language>();

export function getLang(chatId: number): Language {
  return langPrefs.get(chatId) ?? 'hi'; // Default Hinglish
}

export function setLang(chatId: number, lang: Language): void {
  langPrefs.set(chatId, lang);
}

// Get a simple string message
export function msg(chatId: number, key: SimpleMessageKey): string {
  return messages[key][getLang(chatId)] as string;
}
