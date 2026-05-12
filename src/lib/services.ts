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
  | 'catering';

export type ServiceCategory = {
  slug: string;
  key: ServiceKey;
  accent: 'navy' | 'forest';
  /** Hero/thumbnail image for the category (local path or remote URL). */
  image: string;
};

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=70`;

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
];
