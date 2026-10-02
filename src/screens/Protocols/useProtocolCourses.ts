import React from "react";
import { useFocusEffect } from "@react-navigation/native";
import type { ApiProtocolCourse, ApiProtocolNextDose } from "../../API/nouri/protocolTypes";
import { getAuthSessionGeneration } from "../../API/supabase/sessionScope";
import { DB } from "../../store/DB";
import { protocolErrorMessage, useProtocolRead } from "./useProtocolRead";

type CourseSummary = ApiProtocolCourse & { nextDose: ApiProtocolNextDose | null };
type Page = { courses: CourseSummary[]; nextCursor: string | null };

/** Screen-owned course pages, shared by Compounds and the Levels picker.
 * Accepted writes/focus refresh replace the head and discard its old tail.
 * There is no settled global cache or automatic history-draining loop.
 */
export function useProtocolCourses(userId: string, date: string, includeNext = false) {
  const loadPage = async (after?: string): Promise<Page> => {
    const page = await DB.listProtocolCourses(userId, { order: "activity", limit: 30, after });
    const ids = includeNext ? page.courses.filter((course) => course.status === "ACTIVE").map((course) => course.id) : [];
    const next = ids.length ? await DB.getProtocolNextDoses(userId, ids) : null;
    const byId = new Map(next?.courses.map((item) => [item.courseId, item.nextDose]));
    return { ...page, courses: page.courses.map((course) => ({ ...course, nextDose: byId.get(course.id) ?? null })) };
  };
  const query = useProtocolRead(userId, `course-pages:${date}:${includeNext}`, () => loadPage());
  const [tail, setTail] = React.useState<{ head: Page; page: Page } | null>(null);
  const [moreError, setMoreError] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const head = React.useRef(query.data); head.current = query.data;
  const refreshing = React.useRef(query.loading); refreshing.current = query.loading;
  const live = React.useRef(false);
  const sequence = React.useRef(0);
  const busy = React.useRef(false);
  useFocusEffect(React.useCallback(() => {
    live.current = true; setLoadingMore(false); setMoreError(null);
    return () => { live.current = false; sequence.current += 1; busy.current = false; };
  }, [userId]));
  const currentTail = tail && tail.head === query.data ? tail.page : null;
  const courses = [...(query.data?.courses ?? []), ...(currentTail?.courses ?? [])];
  const nextCursor = currentTail ? currentTail.nextCursor : query.data?.nextCursor;
  const loadMore = async () => {
    if (!query.data || !nextCursor || query.loading || busy.current) return;
    const started = query.data; const session = getAuthSessionGeneration(); const request = ++sequence.current;
    const current = () => live.current && sequence.current === request && head.current === started
      && !refreshing.current && session === getAuthSessionGeneration();
    busy.current = true; setLoadingMore(true); setMoreError(null);
    try {
      const page = await loadPage(nextCursor);
      if (current()) {
        const seen = new Set(started.courses.map((course) => course.id));
        const merged = new Map((currentTail?.courses ?? []).map((course) => [course.id, course]));
        for (const course of page.courses) if (!seen.has(course.id)) merged.set(course.id, course);
        setTail({ head: started, page: { courses: [...merged.values()], nextCursor: page.nextCursor } });
      }
    } catch (error) { if (current()) setMoreError(protocolErrorMessage(error)); }
    finally {
      if (sequence.current === request) { busy.current = false; if (live.current) setLoadingMore(false); }
    }
  };
  const reload = async () => { setMoreError(null); await query.reload(); };
  return { ...query, courses, nextCursor, loadMore, loadingMore, moreError, reload };
}
