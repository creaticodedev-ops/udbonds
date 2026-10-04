import { getSignupInfo, registerSelfServeAgency } from '../services/selfServeSignup.js';

export const signupInfo = (_req, res) => {
  res.json({ success: true, ...getSignupInfo() });
};

export const selfServeSignup = async (req, res) => {
  try {
    const result = await registerSelfServeAgency(req.body || {});
    return res.status(201).json({
      success: true,
      message: 'Your RSZ CAR agency request has been submitted and is awaiting approval',
      ...result,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('[selfServeSignup]', error.message);
    return res.status(status).json({
      success: false,
      message: status >= 500 ? 'Failed to create account' : error.message,
      code: error.code || undefined,
    });
  }
};

export default { signupInfo, selfServeSignup };
