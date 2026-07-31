/** Lets any component (e.g. the mobile bottom nav) open the command palette
 * without lifting its state up through the server-rendered `Nav`. */
export const OPEN_SEARCH_EVENT = "tenpoint:open-search";

export function requestSearchOpen() {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}
