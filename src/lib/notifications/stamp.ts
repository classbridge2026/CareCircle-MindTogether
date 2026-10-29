export function noticeStamp(unread: number, ids: readonly string[]) {
  return `${unread}:${ids.join(",")}`;
}
