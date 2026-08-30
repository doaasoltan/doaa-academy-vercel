export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const startLogin = (next?: string) => {
  const target = next || window.location.pathname;
  const query = target && target !== "/login" ? `?next=${encodeURIComponent(target)}` : "";
  window.location.href = `/login${query}`;
};
