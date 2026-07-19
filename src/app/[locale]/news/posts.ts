// Order here controls the news feed; the first entry is the featured / latest.
export const POSTS = ['p4', 'p1', 'p2', 'p3'] as const;

export type PostId = (typeof POSTS)[number];

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=70`;

export const POST_IMAGE: Record<PostId, string> = {
  p4: unsplash('1517090504586-fde19ea6066f'), // Toronto skyline
  p1: unsplash('1519178614-68673b201f36'),
  p2: unsplash('1599685315640-9ceab2f58148'),
  p3: unsplash('1521791136064-7986c2920216'),
};

// Human-friendly URL slugs mapped to their post id.
export const POST_SLUG: Record<PostId, string> = {
  p4: 'now-live-in-canada',
  p1: 'now-live-in-douala-yaounde-and-bafoussam',
  p2: 'spring-2026-seasonal-services',
  p3: 'what-to-expect-from-a-verified-pro',
};

export const SLUG_TO_POST: Record<string, PostId> = Object.fromEntries(
  POSTS.map((id) => [POST_SLUG[id], id]),
) as Record<string, PostId>;
