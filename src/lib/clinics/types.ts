/**
 * Per-clinic configuration. Everything that differs between clinics lives here:
 * branding, hero copy, the doctor(s), theme colours, contact details, SEO and
 * the database file. Generic UI (service list, nav labels, section structure,
 * dashboard, API routes, the WhatsApp bot) is SHARED across every clinic.
 *
 * A new clinic = a new ClinicConfig (+ its own assets and database). The active
 * clinic is chosen once per deployment via the CLINIC / NEXT_PUBLIC_CLINIC env
 * var — so splitting each clinic onto its own host/domain needs zero code change.
 */
export type Bi = { en: string; ar: string };

export type ClinicTheme = {
  primary: string;
  primaryDark: string;
  accent: string;
  background: string;
  surface: string;
  surface2: string;
  /** Text/icon colour that sits on top of a primary/accent fill (buttons,
   *  pills, gradient panels). Defaults to near-black `#0a0e12` (good on the
   *  default gold). Set to `#ffffff` for dark/saturated brand colours (e.g. a
   *  royal-blue center) so on-primary text stays legible. */
  onPrimary?: string;
};

export type ClinicTeamMember = {
  name: Bi;
  role: Bi;
  photo: string;
};

/** A single cutout figure in the hero stage (a team member or the solo doctor). */
export type ClinicHeroFigure = {
  photo: string;
  name?: Bi;
  role?: Bi;
};

/**
 * One before/after showcase item. Grid galleries use a single combined `src`
 * image (tap to open in a lightbox); slider galleries use separate `before` +
 * `after` images (drag-to-compare).
 */
export type GalleryCase = {
  src?: string;
  before?: string;
  after?: string;
  title: Bi;
  tag: Bi;
  /** Optional Tailwind aspect class for slider cases (e.g. "aspect-[4/5]" for
   *  portrait profile shots). Defaults to landscape 16/10. */
  aspect?: string;
};

export type ClinicGallery = {
  /** "grid" = before/after cards + lightbox; "slider" = drag-to-compare handle. */
  style: "grid" | "slider";
  headline: Bi;
  subtitle: Bi;
  cases: GalleryCase[];
};

/** A short-form video clip shown in the "Clinic in Motion" section. */
export type ClinicVideo = {
  src: string;
  title: Bi;
  tag: Bi;
  duration: string;
  /** portrait (9:16 reel) or landscape. Defaults to landscape. */
  orientation?: "portrait" | "landscape";
  /** source filmed sideways — rotate 90° to display upright. */
  rotate?: boolean;
  /** natural aspect for landscape clips, e.g. "1080 / 719". */
  ratio?: string;
};

export type ClinicConfig = {
  /** URL-safe id, also the default database file name (e.g. "badawi"). */
  slug: string;

  /** Short brand shown in the navbar/footer/dashboard. */
  brand: Bi;
  /** Full doctor/clinic name shown in the hero. */
  doctorName: Bi;
  role: Bi;

  hero: {
    badge: Bi;
    title1: Bi;
    title2: Bi;
    subtitle: Bi;
    /** Solo hero cutout photo (public path). Used when `lineup` is empty. */
    photo: string;
    /** Optional multi-figure cutout lineup (e.g. the whole team). When present,
     *  the hero shows these figures instead of the single `photo`. */
    lineup?: ClinicHeroFigure[];
    /** Pill label for an active lineup figure that has no explicit name. */
    lineupLabel?: Bi;
    /** Small hint line shown beneath the hero figure(s). */
    tagline?: Bi;
    /** Optional hero KPI stats (value + bilingual label). Overrides the shared
     *  defaults so a clinic can lead with its own numbers (e.g. years, clinics,
     *  patients). Provide up to three; falls back to the generic set when omitted. */
    stats?: { value: string; label: Bi }[];
    /** For a solo figure, the label under the photo (e.g. the lead doctor when
     *  the clinic brand/`doctorName` is the clinic itself, not a person). */
    figureName?: Bi;
    figureRole?: Bi;
    /** Video shown in the hero's side "tilt" card. `seamless` renders it
     *  borderless with faded edges so it blends into the page (no LIVE badge,
     *  no frame) — reads as part of the site, not an embedded video box. */
    video?: { src: string; poster?: string; seamless?: boolean };
    /** Optional branded still for the hero's side "tilt" card. When set it is
     *  shown instead of the video — ideal for an institution/brand key visual
     *  (e.g. a heritage poster) rather than a talking-head clip. */
    image?: string;
    /** Institution/center clinics can hide the person-cutout stage at the top of
     *  the hero and lead with the brand (big animated name + side key visual)
     *  instead of doctor cutouts. */
    hideStage?: boolean;
  };

  about: {
    role: Bi;
    bio1: Bi;
    bio2: Bi;
    point1: Bi;
    point2: Bi;
    point3: Bi;
    /** Optional lead-doctor profile card shown in the About section. When set,
     *  the site highlights the named dentist (name, title, spoken languages)
     *  alongside the clinic story. Location + phone are read from `contact`. */
    profile?: {
      name: Bi;
      title: Bi;
      languages: Bi;
    };
  };

  /** Doctor/clinic credentials shown as badges in the About section. */
  credentials?: Bi[];

  team: ClinicTeamMember[];

  /** Before/After results section (grid of cases or drag-to-compare sliders). */
  gallery: ClinicGallery;

  /** Short-form clips for the "Clinic in Motion" section. Falls back to a
   *  generic default when omitted. */
  videos?: ClinicVideo[];
  /** Intro line under the videos headline. */
  videosIntro?: Bi;
  /** Optional dedicated "client voices" reels shown in a separate section. */
  testimonialVideos?: ClinicVideo[];
  /** Intro line under the client voices headline. */
  testimonialVideosIntro?: Bi;

  theme: ClinicTheme;

  /** Logo image (public path) for SEO/JSON-LD/OpenGraph. */
  logo?: string;

  contact: {
    phone: string; // E.164, e.g. +2012...
    phoneDisplay: string;
    /** WhatsApp number, digits only (no +). Drives the booking bot + wa.me links. */
    whatsapp: string;
    email: string;
    address: { street: string; locality: string; region: string; country: string; postalCode: string };
    /** Full formatted address for on-page display (bilingual). */
    addressDisplay: Bi;
    /** Working-hours line shown in the footer/booking panel. */
    hours: Bi;
    geo: { lat: number; lng: number };
    /** Google-Maps search query for the directions link. */
    mapQuery: string;
    social: string[];
  };

  seo: {
    description: string;
    descriptionAr: string;
    keywords: string[];
  };

  /** SQLite database file name under prisma/ (defaults to `${slug}.db`). */
  dbFile: string;
};
