export type ServiceKey =
  | 'home'
  | 'beauty'
  | 'outdoor'
  | 'moving'
  | 'seasonal'
  | 'handyman'
  | 'wellness'
  | 'flooring'
  | 'painting'
  | 'carwash'
  | 'catering'
  | 'insurance'
  | 'carrepair'
  | 'shoesclothes'
  | 'rental'
  | 'windowtinting'
  | 'carpool'
  | 'shipping'
  | 'groceries'
  | 'decoration'
  | 'tech'
  | 'tutoring'
  | 'liaison'
  | 'digitalsecurity'
  | 'gaselectricity'
  | 'homephone'
  | 'internet'
  | 'mobility'
  | 'mortgage'
  | 'protection'
  | 'securityautomation'
  | 'television'
  | 'other';

export type ServiceCategory = {
  slug: string;
  key: ServiceKey;
  accent: 'navy' | 'forest';
  /** Hero/thumbnail image for the category (local path or remote URL). */
  image: string;
  /**
   * Set on a sub-service to nest it under a parent category. Nested services
   * stay real, bookable categories with their own page — they're just kept out
   * of the top-level grids and surfaced from the parent instead.
   */
  parent?: ServiceKey;
};

/** Pass `h` for portrait originals so the CDN, not object-cover, picks the crop. */
const unsplash = (id: string, h?: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600${h ? `&h=${h}` : ''}&q=70`;

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { slug: 'home', key: 'home', accent: 'navy', image: unsplash('1581578731548-c64695cc6952') },
  { slug: 'beauty', key: 'beauty', accent: 'forest', image: unsplash('1560066984-138dadb4c035') },
  { slug: 'outdoor', key: 'outdoor', accent: 'forest', image: unsplash('1416879595882-3373a0480b5b') },
  { slug: 'moving', key: 'moving', accent: 'navy', image: unsplash('1600518464441-9154a4dea21b') },
  { slug: 'seasonal', key: 'seasonal', accent: 'navy', image: unsplash('1483664852095-d6cc6870702d') },
  { slug: 'handyman', key: 'handyman', accent: 'forest', image: unsplash('1558618666-fcd25c85cd64') },
  { slug: 'wellness', key: 'wellness', accent: 'navy', image: unsplash('1544161515-4ab6ce6db874') },
  { slug: 'flooring', key: 'flooring', accent: 'forest', image: unsplash('1581858726788-75bc0f6a952d') },
  { slug: 'painting', key: 'painting', accent: 'navy', image: unsplash('1574359411659-15573a27fd0c') },
  { slug: 'carwash', key: 'carwash', accent: 'forest', image: unsplash('1607860108855-64acf2078ed9') },
  { slug: 'catering', key: 'catering', accent: 'navy', image: unsplash('1555244162-803834f70033') },
  { slug: 'insurance', key: 'insurance', accent: 'forest', image: unsplash('1450101499163-c8848c66ca85') },
  { slug: 'car-repair', key: 'carrepair', accent: 'navy', image: unsplash('1530046339160-ce3e530c7d2f') },
  { slug: 'shoes-clothes', key: 'shoesclothes', accent: 'forest', image: unsplash('1441986300917-64674bd600d8') },
  { slug: 'apartment-rental', key: 'rental', accent: 'navy', image: unsplash('1502672260266-1c1ef2d93688') },
  { slug: 'window-tinting', key: 'windowtinting', accent: 'forest', image: unsplash('1486406146926-c627a92ad1ab') },
  { slug: 'carpool', key: 'carpool', accent: 'navy', image: unsplash('1503376780353-7e6692767b70') },
  { slug: 'shipping', key: 'shipping', accent: 'forest', image: unsplash('1607082348824-0a96f2a4b9da') },
  { slug: 'groceries', key: 'groceries', accent: 'navy', image: unsplash('1596040033229-a9821ebd058d') },
  { slug: 'decoration', key: 'decoration', accent: 'forest', image: unsplash('1621419203897-20b66b98d495') },
  { slug: 'tech', key: 'tech', accent: 'navy', image: unsplash('1517694712202-14dd9538aa97') },
  { slug: 'home-tutoring', key: 'tutoring', accent: 'forest', image: unsplash('1503676260728-1c00da094a0b') },
  { slug: 'liaison-agent', key: 'liaison', accent: 'navy', image: unsplash('1689848693914-7ba25d9f3334', 1000) },
  // Handled through a liaison agent — nested under the 'liaison' category above.
  { slug: 'digital-security', key: 'digitalsecurity', accent: 'forest', image: unsplash('1550751827-4bd374c3f58b'), parent: 'liaison' },
  { slug: 'gas-electricity', key: 'gaselectricity', accent: 'navy', image: unsplash('1555009784-ae7e7d1b97aa'), parent: 'liaison' },
  { slug: 'home-phone', key: 'homephone', accent: 'forest', image: unsplash('1560268744-aaab797cdfc4'), parent: 'liaison' },
  { slug: 'internet', key: 'internet', accent: 'navy', image: unsplash('1606904825846-647eb07f5be2'), parent: 'liaison' },
  { slug: 'mobility', key: 'mobility', accent: 'forest', image: unsplash('1554672408-17407e0322ce'), parent: 'liaison' },
  { slug: 'mortgage', key: 'mortgage', accent: 'navy', image: unsplash('1560518883-ce09059eeffa'), parent: 'liaison' },
  { slug: 'protection', key: 'protection', accent: 'forest', image: unsplash('1475503572774-15a45e5d60b9'), parent: 'liaison' },
  { slug: 'security-automation', key: 'securityautomation', accent: 'navy', image: unsplash('1557597774-9d273605dfa9'), parent: 'liaison' },
  { slug: 'television', key: 'television', accent: 'forest', image: unsplash('1593784991251-92ded75ea290'), parent: 'liaison' },
  { slug: 'others', key: 'other', accent: 'navy', image: unsplash('1740065592719-052d3e5ec6fb') },
];

/** Categories shown in the service grids — sub-services surface from their parent. */
export const TOP_LEVEL_SERVICE_CATEGORIES = SERVICE_CATEGORIES.filter((c) => !c.parent);

export const getSubcategories = (key: ServiceKey) =>
  SERVICE_CATEGORIES.filter((c) => c.parent === key);

export const getCategoryByKey = (key: ServiceKey) =>
  SERVICE_CATEGORIES.find((c) => c.key === key);
