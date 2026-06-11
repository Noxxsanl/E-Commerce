import slugify from 'slugify';
import { v4 as uuidv4 } from 'uuid';

export function generateSlug(name: string): string {
  return slugify(name, {
    lower: true,
    strict: true,
    locale: 'vi',
  });
}

export async function generateUniqueSlug(
  name: string,
  checkExists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = generateSlug(name);
  if (!(await checkExists(base))) {
    return base;
  }
  const suffix = uuidv4().split('-')[0];
  return `${base}-${suffix}`;
}
