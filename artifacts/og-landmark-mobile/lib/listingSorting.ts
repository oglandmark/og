type ListingOwner = {
  postedBy: string;
  postedAt: string;
};

export function sortMyListings<T extends ListingOwner>(
  listings: T[],
  userId?: string,
): T[] {
  // /api/my-properties is already scoped to the authenticated account. Let
  // account screens trust that ownership boundary instead of filtering again
  // by sellerId/agentId, which may not match a public User account id.
  const owned = userId ? listings.filter((listing) => listing.postedBy === userId) : listings;
  return [...owned].sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
}
