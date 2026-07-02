/**
 * navHistory — lightweight module-level store for the previous route.
 *
 * Because wouter's hash routing unmounts/remounts page components on every
 * navigation, we can't rely on component state to know "where did we come from".
 * This module persists the last known path across mounts so each owner page can
 * decide whether to show its intro animation.
 *
 * Rule: show the owner intro ONLY when arriving from a different owner section
 * (or from library / root). Skip it when navigating within the same owner
 * (e.g. back from /collections/:id, or switching between profile/collections tabs).
 */

let _prev: string = "";

export const navHistory = {
  get prev() { return _prev; },
  set(path: string) { _prev = path; },
};
