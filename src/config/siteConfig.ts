/** Zentrale Konfiguration: Alle Texte, Links, Bilder und Codes an einer Stelle konfigurierbar.
 */

export interface LinkItem {
  /** i18n key for the card title, e.g. "links.youtube.title" */
  titleKey: string
  /** i18n key for the card description */
  descKey?: string
  url: string
  icon: string
  /** '_blank' for external, '_self' for internal */
  target?: '_blank' | '_self'
  /** Optional discount code (shown + copied on click) */
  discountCode?: string
  /** If set, clicking the card triggers a download confirmation */
  downloadFile?: string
  /** Download file display name */
  downloadName?: string
}

export interface ProfileConfig {
  name: string
  subtitleKey: string
  image: string
}

export interface TwitchConfig {
  channel: string
  chatFallbackUrl: string
  /** ICS calendar URL used to show the next scheduled stream when offline */
  icsUrl: string
}

export interface Link {
  labelKey: string
  url: string
}

export interface OnlyBartConfig { // New interface for OnlyBart settings
    title: string;
    logoUrl: string;
}

export interface ImpressumConfig {
  name: string
  company: string
  street: string
  city: string
  email: string
}

export interface StreamplanCategory {
  /** Stabiler numerischer Bezeichner — wird intern für ICS-URL-Pfade und Filter verwendet. */
  id: number
  labelKey: string
  url: string
  color: string
}

export interface StreamplanConfig {
  icsUrl: string
  categories: StreamplanCategory[]
}

export interface StreamElementsConfig {
  donationUrl: string
}

export interface SiteConfig {
   profile: ProfileConfig
   twitch: TwitchConfig
   impressum: ImpressumConfig
   streamplan: StreamplanConfig
   streamelements: StreamElementsConfig
   links: LinkItem[]
   games: LinkItem[]
   clips: LinkItem[]
   partners: LinkItem[]
   footerLinks: Link[]
   moderatorLink: Link
   copyrightHolder: string
   onlyBart: OnlyBartConfig
   redirects: Record<string, string>
   /** Primäre Akzentfarbe als Hex-Wert (#RRGGBB). Wird per JS als --accent CSS-Variable gesetzt. */
   accentColor: string
 }

const siteConfig: SiteConfig = {
  // ── Profil ──
  profile: {
    name: 'HD1920x1080',
    subtitleKey: 'hero.subtitle',
    image: '/img/logos/HDProfile.webp',
  },

  // ── Twitch ──
  twitch: {
    // Allow overriding the channel via Vite env var VITE_CHANNEL_NAME for different deployments.
    // If not present, fall back to the hardcoded username.
    channel: (import.meta.env.VITE_CHANNEL_NAME as string),

    // Allow overriding the chat fallback URL entirely via VITE_CHAT_FALLBACK_URL.
    // If not set, derive a sensible default from the channel name.
    chatFallbackUrl:
      `https://www.twitch.tv/${(import.meta.env.VITE_CHANNEL_NAME as string)}/chat`,

    icsUrl: '/api/calendar.ics',
  },

  // ── Impressum ──
  impressum: {
    name: 'Stefan Slapnik',
    company: 'FullHD Media',
    street: 'Kolpingstraße 9',
    city: '95615 Marktredwitz',
    email: 'Admin@HD1920x1080.de',
  },

  // ── Streamplan ──
  streamplan: {
    icsUrl: 'https://export.kalender.digital/ics/0/4ccef74582e0eb8d7026/twitchhd1920x1080.ics',
    categories: [
      {
        id: 1,
        labelKey: 'streamplan.categories.gog',
        url: 'https://export.kalender.digital/ics/4648294/4ccef74582e0eb8d7026/gog-goodoldgames.ics',
        color: '#d4af37',
      },
      {
        id: 2,
        labelKey: 'streamplan.categories.justchatting',
        url: 'https://export.kalender.digital/ics/4648295/4ccef74582e0eb8d7026/justchattingreactioncommunitygames.ics',
        color: '#a970ff',
      },
      {
        id: 3,
        labelKey: 'streamplan.categories.grind',
        url: 'https://export.kalender.digital/ics/4648296/4ccef74582e0eb8d7026/grindgames.ics',
        color: '#e91e63',
      },
      {
        id: 4,
        labelKey: 'streamplan.categories.special',
        url: 'https://export.kalender.digital/ics/4648297/4ccef74582e0eb8d7026/besonderesevent.ics',
        color: '#ffd700',
      },
      {
        id: 5,
        labelKey: 'streamplan.categories.multiplayer',
        url: 'https://export.kalender.digital/ics/4648298/4ccef74582e0eb8d7026/multi-playertime.ics',
        color: '#00bcd4',
      },
      {
        id: 6,
        labelKey: 'streamplan.categories.action',
        url: 'https://export.kalender.digital/ics/4649039/4ccef74582e0eb8d7026/actiongames.ics',
        color: '#ff5722',
      },
    ],
  },

  // ── StreamElements / Donations ──
  streamelements: {
    donationUrl: 'https://streamelements.com/hd1920x1080-5003/tip',
  },

  // ── Haupt-Links ──
  links: [
    {
      titleKey: 'links.streamplan.title',
      descKey: 'links.streamplan.desc',
      url: '/streamplan',
      icon: '/img/logos/StreamPlan.webp',
      target: '_self',
    },
    {
      titleKey: 'links.streamelements.title',
      descKey: 'links.streamelements.desc',
      url: '/streamelements',
      icon: '/img/logos/StreamElements.webp',
      target: '_self',
    },
    {
      titleKey: 'links.clipdesmonats.title',
      descKey: 'links.clipdesmonats.desc',
      url: '/clipdesmonats',
      icon: '/img/logos/cdm.webp',
      target: '_self',
    },
    {
      titleKey: 'links.youtube.title',
      descKey: 'links.youtube.desc',
      url: 'https://youtube.com/@hawedereplus',
      icon: '/img/logos/youtube.svg',
      target: '_blank',
    },
    {
      titleKey: 'links.tiktok.title',
      descKey: 'links.tiktok.desc',
      url: 'https://tiktok.com/@hd1920x1080',
      icon: '/img/logos/tiktok.svg',
      target: '_blank',
    },
    {
      titleKey: 'links.instagram.title',
      descKey: 'links.instagram.desc',
      url: 'https://www.instagram.com/hd1920x1080/',
      icon: '/img/logos/instagram.svg',
      target: '_blank',
    },
    {
      titleKey: 'links.onlybart.title',
      descKey: 'links.onlybart.desc',
      url: '/onlybart',
      icon: '/img/logos/OB.webp',
      target: '_self',
    },
    {
      titleKey: 'links.discord.title',
      descKey: 'links.discord.desc',
      url: 'https://discord.gg/Zp5KNqCHzc',
      icon: '/img/logos/discord.svg',
      target: '_blank',
    },
    {
      titleKey: 'links.email.title',
      descKey: 'links.email.desc',
      url: 'mailto:Admin@HD1920x1080.de?subject=Kontaktanfrage',
      icon: '/img/logos/email.svg',
      target: '_self',
    },
  ],

  // ── Games ──
  games: [
    {
      titleKey: 'games.tanggle.title',
      descKey: 'games.tanggle.desc',
      url: 'https://tng.gl/c/hd1920x1080',
      icon: '/img/logos/Puzzle.svg',
      target: '_blank',
    },
    {
      titleKey: 'games.resourcepack.title',
      descKey: 'games.resourcepack.desc',
      url: 'https://github.com/HD1920x1080Media/Minecraft-Ressource-Pack/archive/refs/tags/latest.zip',
      icon: '/img/logos/MinecraftRessourcePack.webp',
      downloadFile:
        'https://github.com/HD1920x1080Media/Minecraft-Ressource-Pack/archive/refs/tags/latest.zip',
      downloadName: 'HD1920x1080_V1.10.zip',
    },
    {
      titleKey: 'games.bartclicker.title',
      descKey: 'games.bartclicker.desc',
      url: '/bartclicker',
      icon: '/img/logos/bartclicker.svg',
      target: '_self',
    },
  ],

  // ── Clips & Shorts ──
  clips: [
    {
      titleKey: 'clips.ytShorts.title',
      descKey: 'clips.ytShorts.desc',
      url: 'https://www.youtube.com/@lesommer2019',
      icon: '/img/logos/youtube.svg',
      target: '_blank',
    },
    {
      titleKey: 'clips.tiktokClips.title',
      descKey: 'clips.tiktokClips.desc',
      url: 'https://www.tiktok.com/@hawedereshorts',
      icon: '/img/logos/tiktok.svg',
      target: '_blank',
    },
    {
      titleKey: 'clips.instaClips.title',
      descKey: 'clips.instaClips.desc',
      url: 'https://www.instagram.com/hawedereshorts/',
      icon: '/img/logos/instagram.svg',
      target: '_blank',
    },
  ],

  // ── Partner ──
  partners: [
    {
      titleKey: 'partners.yvolve.title',
      descKey: 'partners.yvolve.desc',
      url: 'https://yvolve.shop/?bg_ref=cnbZIhbZxH',
      icon: '/img/logos/Evolve.webp',
      target: '_blank',
      discountCode: 'FullHD',
    },
    {
      titleKey: 'partners.nclip.title',
      url: 'https://nclip.io/page/hd1920x1080',
      icon: '/img/logos/NClip.webp',
      target: '_blank',
    },
    {
      titleKey: 'partners.frugends.title',
      descKey: 'partners.frugends.desc',
      url: 'https://frugends.com/?srsltid=AfmBOoqjyBjbK5TWs0tAS4ELgV93XqTXzl84OChVKd93OVkjeWfH8wFT',
      icon: '/img/logos/Frugends.webp',
      target: '_blank',
      discountCode: 'FullHD',
    },
  ],

  moderatorLink: { labelKey: 'profile.moderate', url: '/moderate' },

  // ── Footer ──
  footerLinks: [
    { labelKey: 'footer.impressum', url: '/impressum' },
    { labelKey: 'footer.datenschutz', url: '/datenschutz' }
  ],
  copyrightHolder: 'FullHD Media',

   onlyBart: {
     title: 'OnlyBart',
     logoUrl: '/img/logos/OB.webp'
   },

   accentColor: '#7C4DFF',

   redirects: {
    "/instagram": "https://www.instagram.com/hd1920x1080/",
    "/insta":  "https://www.instagram.com/hd1920x1080/",
    "/yt":  "https://youtube.com/@hawedereplus",
    "/youtube":  "https://youtube.com/@hawedereplus",
    "/tiktok":  "https://tiktok.com/@hd1920x1080",
    "/nclip":  "https://nclip.io/page/hd1920x1080",
    "/puzzle":  "http://tng.gl/c/hd1920x1080",
    "/tanggle":  "http://tng.gl/c/hd1920x1080",
    "/discord":   "https://discord.gg/Zp5KNqCHzc",
    "/dc":   "https://discord.gg/Zp5KNqCHzc",
    "/cdm":   "https://www.hd1920x1080.de/clipdesmonats",
    "/cdj":   "https://www.hd1920x1080.de/clipdesjahres",
    "/rp":   "https://github.com/HD1920x1080Media/Minecraft-Ressource-Pack/archive/refs/tags/latest.zip",
    "/ressourcepack":   "https://github.com/HD1920x1080Media/Minecraft-Ressource-Pack/archive/refs/tags/latest.zip",
    "/twitch":   "https://www.twitch.tv/hd1920x1080",
    "/se":   "https://www.hd1920x1080.de/streamelements",
    "/s":   "https://www.hd1920x1080.de/streamplan",
    "/ob":   "https://www.hd1920x1080.de/onlybart",
    "/c/instagram": "https://www.instagram.com/hawedereshorts/",
    "/c/insta":  "https://www.instagram.com/hawedereshorts/",
    "/c/yt":  "https://www.youtube.com/@lesommer2019",
    "/c/youtube":  "https://www.youtube.com/@lesommer2019",
    "/c/tiktok":  "https://www.tiktok.com/@hawedereshorts"
  }
}

export default siteConfig
