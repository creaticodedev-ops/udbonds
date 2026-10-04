import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

const contractBrandingSchema = new mongoose.Schema(
  {
    companyName: { type: String, default: '', trim: true },
    logoUrl: { type: String, default: '' },
    showLogoOnPdf: { type: Boolean, default: true },
    footerNote: { type: String, default: '', trim: true, maxlength: 500 },
  },
  { _id: false },
);

const socialsSchema = new mongoose.Schema(
  {
    instagram: { type: String, default: '', trim: true },
    facebook: { type: String, default: '', trim: true },
    tiktok: { type: String, default: '', trim: true },
    youtube: { type: String, default: '', trim: true },
    website: { type: String, default: '', trim: true },
  },
  { _id: false },
);

const seoSchema = new mongoose.Schema(
  {
    title: { type: String, default: '', trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 320 },
    ogImageUrl: { type: String, default: '' },
  },
  { _id: false },
);

const heroSchema = new mongoose.Schema(
  {
    headline: { type: String, default: '', trim: true, maxlength: 160 },
    subheadline: { type: String, default: '', trim: true, maxlength: 320 },
    badgeText: { type: String, default: '', trim: true, maxlength: 80 },
    imageUrl: { type: String, default: '' },
  },
  { _id: false },
);

/**
 * Tenant root for RSZ CAR multi-tenant SaaS.
 * Business data is scoped by Agency._id (agencyId).
 */
const agencySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'disabled', 'rejected'],
      default: 'active',
      index: true,
    },
    /** How the tenant was created — self-serve signups require Super Admin approval. */
    createdVia: {
      type: String,
      enum: ['self_serve', 'superadmin_invite', 'admin', 'migration'],
      default: 'superadmin_invite',
      index: true,
    },
    deletedAt: { type: Date, default: null, index: true },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: ObjectId, ref: 'User', default: null },
    rejectedAt: { type: Date, default: null },
    rejectedBy: { type: ObjectId, ref: 'User', default: null },
    rejectionReason: { type: String, default: '', trim: true, maxlength: 500 },
    notifications: {
      email: {
        status: {
          type: String,
          enum: ['idle', 'sent', 'failed', 'skipped', 'not_configured'],
          default: 'idle',
        },
        at: { type: Date, default: null },
        error: { type: String, default: '' },
        messageId: { type: String, default: '' },
      },
      whatsapp: {
        status: {
          type: String,
          enum: ['idle', 'sent', 'failed', 'skipped', 'not_configured', 'link_ready'],
          default: 'idle',
        },
        at: { type: Date, default: null },
        error: { type: String, default: '' },
        waMeUrl: { type: String, default: '' },
      },
    },
    primaryOwnerUserId: {
      type: ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    legacyOwnerId: {
      type: ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    isPublicStorefront: { type: Boolean, default: false },
    logoUrl: { type: String, default: '' },
    faviconUrl: { type: String, default: '' },
    phone: { type: String, default: '', trim: true },
    whatsapp: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true, lowercase: true },
    address: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    country: { type: String, default: '', trim: true },
    postalCode: { type: String, default: '', trim: true },
    addressRegion: { type: String, default: '', trim: true },
    legalName: { type: String, default: '', trim: true },
    taxId: { type: String, default: '', trim: true },
    primaryBrandColor: { type: String, default: '', trim: true },
    secondaryBrandColor: { type: String, default: '', trim: true },
    socials: { type: socialsSchema, default: () => ({}) },
    seo: { type: seoSchema, default: () => ({}) },
    hero: { type: heroSchema, default: () => ({}) },
    contractBranding: { type: contractBrandingSchema, default: () => ({}) },
    /**
     * P3 — custom apex/www domain (without scheme). Only used when status is verified/active.
     * Uniqueness enforced for verified/active rows via partial index.
     */
    customDomain: { type: String, default: '', trim: true, lowercase: true },
    customDomainStatus: {
      type: String,
      enum: ['none', 'pending', 'verified', 'active', 'failed'],
      default: 'none',
    },
    customDomainVerifyToken: { type: String, default: '' },
    customDomainVerifiedAt: { type: Date, default: null },
    /** When true, `{slug}.{PLATFORM_BASE_DOMAIN}` resolves this agency (default on). */
    subdomainEnabled: { type: Boolean, default: true },
    onboardingCompletedAt: { type: Date, default: null },
    timezone: { type: String, default: 'Africa/Casablanca' },
    currency: { type: String, default: 'MAD' },
    locale: { type: String, default: 'fr-MA' },
  },
  { timestamps: true },
);

agencySchema.index(
  { isPublicStorefront: 1 },
  {
    unique: true,
    partialFilterExpression: { isPublicStorefront: true },
  },
);

agencySchema.index(
  { customDomain: 1 },
  {
    unique: true,
    partialFilterExpression: {
      customDomain: { $type: 'string', $ne: '' },
      customDomainStatus: { $in: ['verified', 'active'] },
    },
  },
);

agencySchema.statics.slugify = slugify;

agencySchema.statics.ensureUniqueSlug = async function ensureUniqueSlug(base, excludeId = null) {
  let slug = slugify(base) || `agency-${Date.now().toString(36)}`;
  let n = 0;
  while (true) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const existing = await this.findOne({
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select('_id')
      .lean();
    if (!existing) return candidate;
    n += 1;
    if (n > 1000) return `${slug}-${Date.now().toString(36)}`;
  }
};

const Agency = mongoose.model('Agency', agencySchema);
export default Agency;
export { slugify };
