export const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildCaseInsensitiveEmailQuery = (value) => {
  const normalized = normalizeEmail(value);
  if (!normalized) {
    return null;
  }

  return {
    email: {
      $regex: `^${escapeRegex(normalized)}$`,
      $options: 'i',
    },
  };
};

export const findUserByEmail = async (UserModel, value) => {
  const query = buildCaseInsensitiveEmailQuery(value);
  if (!query) {
    return null;
  }

  return UserModel.findOne(query);
};
