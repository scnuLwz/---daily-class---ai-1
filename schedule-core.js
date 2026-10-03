(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ScheduleCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function activeIn(session, week) {
    if (!session || !Array.isArray(session.weeks)) return false;
    const first = Number(session.weeks[0]);
    const last = Number(session.weeks[1]);
    if (!Number.isFinite(first) || !Number.isFinite(last) || week < first || week > last) return false;
    if (session.parity === "odd") return week % 2 === 1;
    if (session.parity === "even") return week % 2 === 0;
    return true;
  }

  function sessionsOverlap(a, b) {
    if (!a || !b) return false;
    return Number(a.day) === Number(b.day) && Number(a.from) <= Number(b.to) && Number(b.from) <= Number(a.to);
  }

  function sharedActiveWeek(a, b) {
    if (!sessionsOverlap(a, b)) return 0;
    const first = Math.max(Number(a.weeks?.[0]), Number(b.weeks?.[0]));
    const last = Math.min(Number(a.weeks?.[1]), Number(b.weeks?.[1]));
    if (!Number.isFinite(first) || !Number.isFinite(last) || first > last) return 0;
    for (let week = first; week <= last; week += 1) {
      if (activeIn(a, week) && activeIn(b, week)) return week;
    }
    return 0;
  }

  function findConflicts(sessions) {
    const list = Array.isArray(sessions) ? sessions.slice() : [];
    const conflicts = [];
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const week = sharedActiveWeek(list[i], list[j]);
        if (week) conflicts.push({ a: list[i], b: list[j], week });
      }
    }
    return conflicts;
  }

  function validateSchedule(data) {
    const errors = [];
    if (!data || typeof data !== "object") return ["课表数据必须是一个对象"];
    if (!Array.isArray(data.timeSlots) || !data.timeSlots.length) errors.push("缺少作息时间");
    if (!Array.isArray(data.courses)) errors.push("缺少课程列表");
    if (!Array.isArray(data.sessions)) errors.push("缺少课次列表");
    if (errors.length) return errors;

    const courseIds = new Set();
    data.courses.forEach((course, index) => {
      if (!course || !course.id) errors.push(`课程 ${index + 1} 缺少 id`);
      else if (courseIds.has(course.id)) errors.push(`课程 id 重复：${course.id}`);
      else courseIds.add(course.id);
    });

    data.sessions.forEach((session, index) => {
      const label = `课次 ${index + 1}`;
      if (!session || !courseIds.has(session.courseId)) errors.push(`${label} 引用了不存在的课程`);
      const day = Number(session?.day);
      const from = Number(session?.from);
      const to = Number(session?.to);
      if (!Number.isInteger(day) || day < 1 || day > 7) errors.push(`${label} 的星期必须是 1-7`);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > 11 || from > to) errors.push(`${label} 的节次范围不正确`);
      if (!Array.isArray(session?.weeks) || session.weeks.length !== 2 || Number(session.weeks[0]) > Number(session.weeks[1])) errors.push(`${label} 的周次范围不正确`);
      if (!["all", "odd", "even"].includes(session?.parity || "all")) errors.push(`${label} 的单双周设置不正确`);
    });

    return errors;
  }

  return { activeIn, sessionsOverlap, sharedActiveWeek, findConflicts, validateSchedule };
});
