export const POST_AD_LISTING_ROUTE = '/post/listing' as const;

export function shouldOpenPostAdListing(isLoading: boolean, isLoggedIn: boolean): boolean {
  return !isLoading && isLoggedIn;
}
