import Agency from '../models/Agency.js';

/** Resolve Agency._id from a legacy/primary owner user id. */
export const resolveAgencyIdFromOwner = async (ownerId) => {
  if (!ownerId) return null;
  const agency = await Agency.findOne({ legacyOwnerId: ownerId }).select('_id').lean();
  return agency?._id || null;
};

export default resolveAgencyIdFromOwner;
