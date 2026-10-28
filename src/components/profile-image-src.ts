export function profileImageSrc(userId: string, version: string) {
  return `/profile-image/${userId}?v=${encodeURIComponent(version)}`;
}
