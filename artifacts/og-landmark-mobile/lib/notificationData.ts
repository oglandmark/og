export type NotificationCategory =
  | 'properties'
  | 'projects'
  | 'announcements'
  | 'promotional'
  | 'account'
  | 'system';

export type AppNotification = {
  id: number | string;
  notificationId: string;
  recipientUserId: number;
  type: string;
  category: NotificationCategory;
  title: string;
  message: string;
  body: string;
  imageUrl?: string | null;
  entityType?: string | null;
  entityId?: string | number | null;
  propertyId?: string | number | null;
  projectId?: string | number | null;
  announcementId?: string | number | null;
  deepLink?: string | null;
  priority?: 'NORMAL' | 'HIGH' | 'URGENT';
  isRead: boolean;
  read: boolean;
  readAt?: string | null;
  createdAt: string;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type NotificationPage = {
  items: AppNotification[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  unreadCount: number;
};

export type NotificationPreferences = {
  properties: boolean;
  projects: boolean;
  announcements: boolean;
  promotional: boolean;
  account: boolean;
  system: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
  cities?: string[];
  propertyTypes?: string[];
};

const notificationCategories = new Set<NotificationCategory>([
  'properties', 'projects', 'announcements', 'promotional', 'account', 'system',
]);

function normalizeNotification(value: unknown): AppNotification {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The notifications response contains an invalid item.');
  }

  const item = value as Record<string, unknown>;
  const id = item.notificationId ?? item.id;
  if (typeof id !== 'number' && typeof id !== 'string') {
    throw new Error('The notifications response contains an item without an ID.');
  }

  const message = typeof item.message === 'string'
    ? item.message
    : typeof item.body === 'string' ? item.body : '';
  const body = typeof item.body === 'string' ? item.body : message;
  const title = typeof item.title === 'string' && item.title.trim()
    ? item.title
    : message || 'Update';
  const isRead = Boolean(item.isRead ?? item.read);
  const category = typeof item.category === 'string'
    && notificationCategories.has(item.category as NotificationCategory)
    ? item.category as NotificationCategory
    : 'system';

  return {
    ...item,
    id: (item.id ?? id) as number | string,
    notificationId: String(item.notificationId ?? id),
    recipientUserId: Number(item.recipientUserId ?? item.userId ?? item.recipientId ?? 0),
    type: typeof item.type === 'string' ? item.type : category,
    category,
    title,
    message,
    body,
    entityType: typeof item.entityType === 'string' ? item.entityType : null,
    entityId: typeof item.entityId === 'string' || typeof item.entityId === 'number'
      ? item.entityId : null,
    propertyId: typeof item.propertyId === 'string' || typeof item.propertyId === 'number'
      ? item.propertyId : null,
    projectId: typeof item.projectId === 'string' || typeof item.projectId === 'number'
      ? item.projectId : null,
    announcementId: typeof item.announcementId === 'string' || typeof item.announcementId === 'number'
      ? item.announcementId : null,
    deepLink: typeof item.deepLink === 'string' ? item.deepLink : null,
    isRead,
    read: isRead,
    createdAt: typeof item.createdAt === 'string'
      ? item.createdAt
      : typeof item.timestamp === 'string' ? item.timestamp : '',
  } as AppNotification;
}

export function normalizeNotificationPage(
  response: unknown,
  options: { page?: number; limit?: number; category?: NotificationCategory | 'all' } = {},
): NotificationPage {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const limit = Math.max(1, Math.floor(options.limit ?? 25));
  const category = options.category ?? 'all';

  if (Array.isArray(response)) {
    const allItems = response.map(normalizeNotification);
    const filtered = category === 'all'
      ? allItems
      : allItems.filter((item) => item.category === category);
    const start = (page - 1) * limit;
    return {
      items: filtered.slice(start, start + limit),
      page,
      limit,
      total: filtered.length,
      hasMore: start + limit < filtered.length,
      unreadCount: filtered.filter((item) => !item.isRead).length,
    };
  }

  if (!response || typeof response !== 'object' || !Array.isArray((response as { items?: unknown }).items)) {
    throw new Error('The notifications service returned an unsupported response.');
  }

  const result = response as Partial<NotificationPage>;
  const items = result.items!.map(normalizeNotification);
  return {
    items,
    page: typeof result.page === 'number' ? result.page : page,
    limit: typeof result.limit === 'number' ? result.limit : limit,
    total: typeof result.total === 'number' ? result.total : items.length,
    hasMore: typeof result.hasMore === 'boolean' ? result.hasMore : false,
    unreadCount: typeof result.unreadCount === 'number'
      ? result.unreadCount
      : items.filter((item) => !item.isRead).length,
  };
}
