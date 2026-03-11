import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import Sidebar from '../components/Sidebar';
import { normalizeExamCategories } from '../examPayload';

const sidebarItems = [
  { label: 'Classes', to: '/dashboard' },
  { label: 'All Exams', to: '/exams' },
];

const examSections = [
  {
    key: 'availableExams',
    title: 'Available Now',
    description: 'Open exams that can be started right away.',
    empty: 'No live exams right now.',
    badgeClass: 'status-pill--available',
    badgeLabel: 'Available',
  },
  {
    key: 'upcomingExams',
    title: 'Upcoming',
    description: 'Scheduled exams across all joined classes.',
    empty: 'No upcoming exams scheduled.',
    badgeClass: 'status-pill--upcoming',
    badgeLabel: 'Upcoming',
  },
  {
    key: 'completedExams',
    title: 'Completed',
    description: 'Finished exams and currently visible results.',
    empty: 'No completed exams yet.',
    badgeClass: 'status-pill--completed',
    badgeLabel: 'Completed',
  },
];

function formatDateLabel(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'TBA';
  }

  return date.toLocaleDateString(undefined, options);
}

function formatTimeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'TBA';
  }

  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function sortByStartTime(left, right) {
  return new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
}

function getExamGroupKey(exam) {
  return String(exam?.groupId?._id || exam?.groupId || '');
}

export default function ExamList() {
  const [examCategories, setExamCategories] = useState({ availableExams: [], upcomingExams: [], completedExams: [] });
  const [groups, setGroups] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchExams = async () => {
      try {
        setLoading(true);
        setError('');

        const [examRes, groupRes, resultRes, sessionsRes] = await Promise.all([
          API.get('/exams'),
          API.get('/groups/joined'),
          API.get('/exams/results/me'),
          API.get('/exams/sessions/me'),
        ]);

        const submittedExamIds = new Set(sessionsRes.data?.submittedExamIds || []);
        setExamCategories(normalizeExamCategories(examRes.data, submittedExamIds));
        setGroups(groupRes.data || []);
        setResults(resultRes.data || []);
      } catch (err) {
        console.error(err);
        setError('Unable to load your exams right now.');
      } finally {
        setLoading(false);
      }
    };
    fetchExams();
  }, []);

  const groupNameById = useMemo(() => (
    new Map(groups.map((group) => [String(group._id), group.name]))
  ), [groups]);
  const resultsByExamId = useMemo(() => (
    new Map(results.map((result) => [String(result.exam?._id || result.exam || ''), result]))
  ), [results]);
  const sortedSections = useMemo(() => ({
    availableExams: [...examCategories.availableExams].sort(sortByStartTime),
    upcomingExams: [...examCategories.upcomingExams].sort(sortByStartTime),
    completedExams: [...examCategories.completedExams].sort(sortByStartTime).reverse(),
  }), [examCategories]);
  const summary = useMemo(() => ({
    classes: groups.length,
    available: sortedSections.availableExams.length,
    upcoming: sortedSections.upcomingExams.length,
    completed: sortedSections.completedExams.length,
  }), [groups.length, sortedSections]);

  return (
    <div className='dashboard-layout'>
      <Sidebar title='Classroom' items={sidebarItems} />
      <section className='dashboard-main classroom-main'>
        <div className='card classroom-hero classroom-hero--compact'>
          <div className='classroom-hero-copy'>
            <span className='profile-eyebrow classroom-eyebrow'>All exams</span>
            <h2>Exam Timeline</h2>
            <p>
              Track live, scheduled, and completed exams across every class you have joined.
            </p>
          </div>

          <div className='classroom-hero-stats'>
            <div>
              <strong>{summary.classes}</strong>
              <span>Classes</span>
            </div>
            <div>
              <strong>{summary.available}</strong>
              <span>Available</span>
            </div>
            <div>
              <strong>{summary.upcoming}</strong>
              <span>Upcoming</span>
            </div>
            <div>
              <strong>{summary.completed}</strong>
              <span>Completed</span>
            </div>
          </div>
        </div>

        {error && <div className='alert error'>{error}</div>}

        {examSections.map((section) => (
          <section className='card classroom-exam-section' key={section.key}>
            <div className='split classroom-section-head'>
              <div>
                <h3>{section.title}</h3>
                <p className='muted'>{section.description}</p>
              </div>
              <span className='classroom-section-count'>
                {sortedSections[section.key].length} exam{sortedSections[section.key].length === 1 ? '' : 's'}
              </span>
            </div>

            {loading ? (
              <LoadingSpinner label='Loading exams...' minHeight='180px' />
            ) : sortedSections[section.key].length > 0 ? (
              <div className='classroom-exam-grid classroom-exam-grid--wide'>
                {sortedSections[section.key].map((exam) => {
                  const result = resultsByExamId.get(String(exam._id));
                  const endMs = new Date(exam.startTime).getTime() + (exam.duration || 0) * 60000;
                  const resultPending =
                    (exam.resultVisibility === 'delayed' && !exam.resultsPublished) ||
                    (exam.resultVisibility === 'immediate' && Date.now() < endMs);
                  return (
                    <article className='classroom-exam-card' key={exam._id}>
                      <div className='classroom-exam-card-top'>
                        <span className={`status-pill ${section.badgeClass}`}>{section.badgeLabel}</span>
                        <span className='muted' style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                          {exam.duration} min
                        </span>
                      </div>

                      <div className='classroom-exam-card-copy'>
                        <h4>{exam.title}</h4>
                        <p>{exam.description || groupNameById.get(getExamGroupKey(exam)) || 'Joined class'}</p>
                      </div>

                      <div className='classroom-exam-meta'>
                        <div>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            DATE
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                          </span>
                          <strong>{formatDateLabel(exam.startTime)}</strong>
                        </div>
                        <div>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            TIME
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                          </span>
                          <strong>{formatTimeLabel(exam.startTime)}</strong>
                        </div>
                        <div>
                          <span>QUESTIONS</span>
                          <strong>{exam.questions?.length || exam.numberOfQuestions || '-'}</strong>
                        </div>
                      </div>

                      {section.key === 'completedExams' ? (
                        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-color)', lineHeight: '1.4' }}>
                            {result ? (
                              <><p><strong>Score:</strong> {`${Number(result.percentage || 0).toFixed(0)}% (${result.score}/${result.total} points)`} </p>
                                <p><strong>Submitted:</strong> {new Date(result.submittedAt).toLocaleString()}</p></>
                            ) : resultPending ? (
                              <><strong>Results:</strong> Pending publication. We will notify you when results are available.</>
                            ) : (
                              <><strong>Results:</strong> No visible result is available for your account.</>
                            )}
                          </div>
                          <div>
                            {result ? (
                              <Link
                                to={`/exam/${exam._id}/results`}
                                className='btn'
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                View results
                              </Link>
                            ) : (
                              <span className='btn secondary btn-disabled' style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                No result
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className='classroom-exam-footer'>
                          <div>
                            <strong>{groupNameById.get(getExamGroupKey(exam)) || 'Joined class'}</strong>
                            <span>
                              Opens {formatDateLabel(exam.startTime)} at {formatTimeLabel(exam.startTime)}
                            </span>
                          </div>
                          <Link className='btn' to={`/exam/${exam._id}`}>
                            Open lobby
                          </Link>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className='classroom-empty-state'>
                <p className='muted'>{section.empty}</p>
              </div>
            )}
          </section>
        ))}
      </section>
    </div>
  );
}
