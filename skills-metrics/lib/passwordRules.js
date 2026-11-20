// =============================================================================
// passwordRules.js · The new-password rules, shared by the Sign In screen (checklist) and the server (enforcement)
// Screen / URL: /signin "Set your password" step
// Used by: components/SMSignIn.jsx, app/api/auth/password/route.js   Depends on: nothing
// Sections (search for these markers): PASSWORD RULES
// =============================================================================

// ===== PASSWORD RULES · List =====
// Each rule: [label shown on screen, test(newPassword, currentPassword)].
export const PASSWORD_RULES = [
  ['At least 8 characters', np => np.length >= 8],
  ['An uppercase letter', np => /[A-Z]/.test(np)],
  ['A lowercase letter', np => /[a-z]/.test(np)],
  ['A number', np => /\d/.test(np)],
  ['A symbol (e.g. ! @ # $)', np => /[^A-Za-z0-9]/.test(np)],
  ['Different from your temporary password', (np, cur) => !!np && np !== cur],
];

// ===== PASSWORD RULES · Check =====
// Returns the labels of the rules that fail (empty = the password is acceptable).
export const failedPasswordRules = (np, cur) => PASSWORD_RULES.filter(([, test]) => !test(np || '', cur || '')).map(([label]) => label);
