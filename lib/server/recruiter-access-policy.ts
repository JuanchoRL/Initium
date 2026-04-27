type AccessRule = {
  organizationId: string;
  matcher: string;
};

function parseAccessRules(raw: string | undefined) {
  if (!raw?.trim()) return [];

  return raw
    .split(';')
    .flatMap((group) => {
      const [organizationPart, matchersPart] = group.includes(':') ? group.split(':', 2) : ['default', group];
      const organizationId = organizationPart.trim() || 'default';
      return matchersPart
        .split(',')
        .map((matcher) => matcher.trim().toLowerCase())
        .filter(Boolean)
        .map((matcher): AccessRule => ({ organizationId, matcher }));
    });
}

export function resolveRecruiterAccess(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const rules = parseAccessRules(process.env.INITIUM_RECRUITER_ALLOWLIST);

  if (!rules.length) {
    return {
      allowed: true,
      organizationId: process.env.INITIUM_DEFAULT_ORGANIZATION_ID?.trim() || 'default',
      reason: null,
    };
  }

  const matchingRule = rules.find((rule) => {
    if (rule.matcher.startsWith('@')) return normalizedEmail.endsWith(rule.matcher);
    return normalizedEmail === rule.matcher;
  });

  if (!matchingRule) {
    return {
      allowed: false,
      organizationId: null,
      reason: 'Recruiter email is not authorized for this workspace',
    };
  }

  return {
    allowed: true,
    organizationId: matchingRule.organizationId,
    reason: null,
  };
}
