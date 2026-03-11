function createEmptyExamCategories() {
  return {
    availableExams: [],
    upcomingExams: [],
    completedExams: [],
  };
}

export function normalizeExamList(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const seen = new Set();

  return [
    ...(payload.availableExams || []),
    ...(payload.upcomingExams || []),
    ...(payload.completedExams || []),
  ].filter((exam) => {
    if (!exam?._id || seen.has(exam._id)) {
      return false;
    }

    seen.add(exam._id);
    return true;
  });
}

export function normalizeExamCategories(payload, submittedExamIds = new Set()) {
  if (!payload) {
    return createEmptyExamCategories();
  }

  if (!Array.isArray(payload)) {
    return {
      availableExams: Array.isArray(payload.availableExams) ? payload.availableExams : [],
      upcomingExams: Array.isArray(payload.upcomingExams) ? payload.upcomingExams : [],
      completedExams: Array.isArray(payload.completedExams) ? payload.completedExams : [],
    };
  }

  const now = Date.now();

  return payload.reduce(
    (categories, exam) => {
      const startMs = new Date(exam?.startTime).getTime();
      const durationMs = Number(exam?.duration || 0) * 60000;
      const endMs = startMs + durationMs;

      if (
        exam?.status === 'Completed' ||
        exam?.status === 'Ended' ||
        endMs <= now ||
        submittedExamIds.has(String(exam?._id))
      ) {
        categories.completedExams.push(exam);
        return categories;
      }

      if (startMs > now) {
        categories.upcomingExams.push(exam);
        return categories;
      }

      if (startMs <= now && endMs > now && exam?.status === 'Active') {
        categories.availableExams.push(exam);
      }

      return categories;
    },
    createEmptyExamCategories(),
  );
}
