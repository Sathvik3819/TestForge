import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import { normalizeExamCategories, normalizeExamList } from '../examPayload';

const classroomAccents = [
  'classroom-card--indigo',
  'classroom-card--teal',
  'classroom-card--amber',
  'classroom-card--rose',
];

function formatDateLabel(value, options = { day: 'numeric', month: 'short' }) {
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

function getExamGroupKey(exam) {
  return String(exam?.groupId?._id || exam?.groupId || '');
}

function sortByStartTime(left, right) {
  return new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
}

export default function UserDashboard() {
  const [examCategories, setExamCategories] = useState({ availableExams: [], upcomingExams: [], completedExams: [] });
  const [groups, setGroups] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [groupStatus, setGroupStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      const [examRes, groupRes, sessionsRes] = await Promise.all([
        API.get('/exams'),
        API.get('/groups/joined'),
        API.get('/exams/sessions/me'),
      ]);

      const submittedExamIds = new Set(sessionsRes.data?.submittedExamIds || []);
      setExamCategories(normalizeExamCategories(examRes.data, submittedExamIds));
      setGroups(groupRes.data || []);
    } catch (err) {
      console.error(err);
      setError('Unable to load your classroom right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const classroomCards = useMemo(() => {
    const examsByGroup = normalizeExamList(examCategories).reduce((collection, exam) => {
      const groupKey = getExamGroupKey(exam);

      if (!groupKey) {
        return collection;
      }

      const existing = collection.get(groupKey) || [];
      existing.push(exam);
      collection.set(groupKey, existing);
      return collection;
    }, new Map());

    return groups.map((group, index) => {
      const groupExams = examsByGroup.get(String(group._id)) || [];
      const categorized = normalizeExamCategories(groupExams);
      const nextExam = [...categorized.availableExams, ...categorized.upcomingExams]
        .sort(sortByStartTime)[0];

      return {
        ...group,
        accentClass: classroomAccents[index % classroomAccents.length],
        availableCount: categorized.availableExams.length,
        upcomingCount: categorized.upcomingExams.length,
        completedCount: categorized.completedExams.length,
        nextExam,
      };
    });
  }, [examCategories, groups]);

  const summary = useMemo(() => ({
    classes: groups.length,
    available: examCategories.availableExams.length,
    upcoming: examCategories.upcomingExams.length,
    completed: examCategories.completedExams.length,
  }), [examCategories, groups.length]);

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    setGroupStatus('');

    try {
      await API.post('/groups/join', { joinCode });
      setJoinCode('');
      setIsJoinModalOpen(false);
      setGroupStatus('Joined class successfully.');
      fetchDashboardData();
    } catch (err) {
      setGroupStatus(err.response?.data?.error || 'Unable to join class.');
    }
  };

  const openJoinModal = () => {
    setJoinCode('');
    setGroupStatus('');
    setIsJoinModalOpen(true);
  };

  const closeJoinModal = () => {
    setJoinCode('');
    setGroupStatus('');
    setIsJoinModalOpen(false);
  };

  return (
    <div className='container'>
      <section className='dashboard-main classroom-main classroom-main--student'>
        <div className='classroom-page-head'>
          <div>
            <h2>Joined Classes</h2>
            <p>Open any class to view its available, upcoming, and completed exams in one place.</p>
          </div>
        </div>

        <div className='classroom-mini-stats'>
          <div className='card classroom-mini-stat'>
            <span>Classes</span>
            <strong>{summary.classes}</strong>
          </div>
          <div className='card classroom-mini-stat'>
            <span>Available</span>
            <strong>{summary.available}</strong>
          </div>
          <div className='card classroom-mini-stat'>
            <span>Upcoming</span>
            <strong>{summary.upcoming}</strong>
          </div>
          <div className='card classroom-mini-stat'>
            <span>Completed</span>
            <strong>{summary.completed}</strong>
          </div>
        </div>

        {error && <div className='alert error'>{error}</div>}

        <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className='classroom-section-head' style={{display:'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <h3>Classes</h3>
                <p className='muted'>Open a classroom to manage all of its exams from one page.</p>
              </div>

              <button
                type='button'
                className='btn'
                style={{ maxWidth: '200px' }}
                onClick={openJoinModal}
              >
                Join classroom
              </button>
            </div>
            {groupStatus && !isJoinModalOpen && (
              <div className={`alert ${groupStatus.toLowerCase().includes('successfully') ? 'success' : 'error'}`}>
                {groupStatus}
              </div>
            )}
            {loading ? (
              <div className='card classroom-empty-state'>
                <LoadingSpinner label='Loading your classes...' minHeight='140px' />
              </div>
            ) : classroomCards.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {classroomCards.map((group) => (
                  <Link
                    key={group._id}
                    to={`/groups/${group._id}`}
                    style={{ display: 'flex', flexDirection: 'column', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: '#fff', textDecoration: 'none', color: 'inherit', overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s' }}
                    className='custom-dashboard-card'
                  >
                    <div style={{ backgroundColor: '#e5e7eb', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Code: {group.joinCode}
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h6v6H4z"></path><path d="M14 4h6v6h-6z"></path><path d="M14 14h6v6h-6z"></path><path d="M4 14h6v6H4z"></path></svg>
                      </span>
                      <span style={{ backgroundColor: '#43b5a0', color: '#fff', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Ready
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                      </span>
                    </div>

                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1 }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', color: '#111827' }}>{group.name}</h3>
                        <div style={{ fontSize: '0.85rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                          Joined {formatDateLabel(group.joinedAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>

                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151', minHeight: '1.5rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {group.description || 'No description provided'}
                      </p>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 10px', borderRadius: '10px', fontSize: '0.85rem' }}>{group.availableCount} available</span>
                        <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 10px', borderRadius: '10px', fontSize: '0.85rem' }}>{group.upcomingCount} upcoming</span>
                        <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 10px', borderRadius: '10px', fontSize: '0.85rem' }}>{group.completedCount} completed</span>
                      </div>

                      <div style={{ paddingTop: '16px' }}>
                        <div style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '4px' }}>Exam Status</div>
                        {group.nextExam ? (
                          <>
                            <div style={{ fontWeight: 600, fontSize: '1rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {group.nextExam.title}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '2px' }}>
                              {formatDateLabel(group.nextExam.startTime, { day: 'numeric', month: 'short' })} at {formatTimeLabel(group.nextExam.startTime)}
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontWeight: 600, fontSize: '1rem', color: '#111827', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              No scheduled exams
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '2px' }}>
                              Open the classroom to review current and past exams.
                            </div>
                          </>
                        )}
                      </div>

                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className='card classroom-empty-state'>
                <h3>No joined classes yet</h3>
                <p className='muted'>
                  Use a join code to enter your first classroom. Once you join, each class will show up here.
                </p>
              </div>
            )}
        </section>

        {isJoinModalOpen && (
          <div className='admin-modal-backdrop' onClick={closeJoinModal}>
            <div className='card admin-modal-card' onClick={(e) => e.stopPropagation()}>
              <div className='split'>
                <div>
                  <h3>Join classroom</h3>
                  <p className='muted'>Enter the code shared by your teacher.</p>
                </div>
                <button type='button' className='btn secondary' onClick={closeJoinModal}>
                  Close
                </button>
              </div>

              <form onSubmit={handleJoinGroup} className='auth-form'>
                <div>
                  <label>Join code</label>
                  <input
                    required
                    autoFocus
                    value={joinCode}
                    placeholder='Enter class code'
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  />
                </div>

                {groupStatus && (
                  <div className={`alert ${groupStatus.toLowerCase().includes('successfully') ? 'success' : 'error'}`}>
                    {groupStatus}
                  </div>
                )}

                <div className='admin-modal-actions'>
                  <button type='button' className='btn secondary' onClick={closeJoinModal}>
                    Cancel
                  </button>
                  <button type='submit' className='btn'>Join class</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
