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
  | 'shipping';

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
  { slug: 'insurance', key: 'insurance', accent: 'forest', image: unsplash('1450101499163-c8848c66ca85') },
  { slug: 'car-repair', key: 'carrepair', accent: 'navy', image: unsplash('1530046339160-ce3e530c7d2f') },
  { slug: 'shoes-clothes', key: 'shoesclothes', accent: 'forest', image: unsplash('1441986300917-64674bd600d8') },
  { slug: 'apartment-rental', key: 'rental', accent: 'navy', image: unsplash('1502672260266-1c1ef2d93688') },
  { slug: 'window-tinting', key: 'windowtinting', accent: 'forest', image: unsplash('1486406146926-c627a92ad1ab') },
  { slug: 'carpool', key: 'carpool', accent: 'navy', image: unsplash('1503376780353-7e6692767b70') },
  { slug: 'shipping', key: 'shipping', accent: 'forest', image: unsplash('1605745341112-85968b19335b') },
];
