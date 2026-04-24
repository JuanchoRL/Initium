export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const avg = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
};

export const stdDev = (values: number[]) => {
  if (values.length < 2) return 0;
  const m = avg(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

export const entropy = (probabilities: number[]) => {
  return probabilities.reduce((acc, p) => {
    if (p <= 0) return acc;
    return acc - p * Math.log2(p);
  }, 0);
};

export const toSafeNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const maskEmail = (email: string) => {
  const [name, domain] = email.split('@');
  if (!name || !domain) return 'masked';
  if (name.length <= 2) return `${name[0] ?? '*'}***@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
};
