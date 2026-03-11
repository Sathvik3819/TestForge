import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import API from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContextValue';
import { normalizeExamCategories } from '../examPayload';
import AdminResults from '../sections/AdminResults';

const studentExamSections = [
  {
    key: 'availableExams',
    title: 'Available Now',
    description: 'These exams are live inside the current window.',
    empty: 'No live exams in this class right now.',
    badgeClass: 'status-pill--available',
    badgeLabel: 'Available',
  },
  {
    key: 'upcomingExams',
    title: 'Upcoming',
    description: 'Scheduled exams that open later.',
    empty: 'No upcoming exams scheduled for this class.',
    badgeClass: 'status-pill--upcoming',
    badgeLabel: 'Upcoming',
  },
  {
    key: 'completedExams',
    title: 'Completed',
    description: 'Finished exams and released results.',
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

function formatDateTimeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'TBA';
  }

  return date.toLocaleString();
}

function sortByStartTime(left, right) {
  return new Date(left.startTime).getTime() - new Date(right.startTime).getTime();
}

export default function GroupDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [submittedSessionIds, setSubmittedSessionIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [feedback, setFeedback] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('exams');

  const loadGroup = useCallback(async () => {
    try {
      setLoading(true);
      setFeedback((prev) => (prev.type === 'error' ? { type: '', text: '' } : prev));

      const groupRes = await API.get(`/groups/${id}`);
      const nextGroup = groupRes.data;
      const createdContext =
        user?.role === 'admin' &&
        String(nextGroup?.createdBy || '') === String(user?.id || '');

      const [membersRes, examsRes, resultsRes, sessionsRes] = await Promise.all([
        API.get(`/groups/${id}/members`),
        API.get(`/groups/${id}/exams${createdContext ? '' : '?scope=joined'}`),
        API.get(`/groups/${id}/results${createdContext ? '' : '?scope=mine'}`),
        API.get('/exams/sessions/me'),
      ]);

      setGroup(nextGroup);
      setMembers(membersRes.data || []);
      setExams(examsRes.data || []);
      setResults(resultsRes.data || []);
      setSubmittedSessionIds(new Set(sessionsRes.data?.submittedExamIds || []));
    } catch (err) {
      setGroup(null);
      setMembers([]);
      setExams([]);
      setResults([]);
      setSubmittedSessionIds(new Set());
      setFeedback({
        type: 'error',
        text: err.response?.data?.error || 'Failed to load group.',
      });
    } finally {
      setLoading(false);
    }
  }, [id, user?.id, user?.role]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  const isCreatedGroup =
    user?.role === 'admin' &&
    String(group?.createdBy || '') === String(user?.id || '');
  const showAdminControls = isCreatedGroup;
  const adminSidebarItems = [
    { label: 'Dashboard', onClick: () => navigate('/admin', { state: { section: 'dashboard' } }) },
    { label: 'Live Monitoring', onClick: () => navigate('/admin', { state: { section: 'monitoring' } }) },
    { label: 'Candidates', onClick: () => navigate('/admin', { state: { section: 'candidates' } }) },
  ];

  const examCategories = useMemo(() => normalizeExamCategories(exams, submittedSessionIds), [exams, submittedSessionIds]);
  const sortedCategories = useMemo(() => ({
    availableExams: [...examCategories.availableExams].sort(sortByStartTime),
    upcomingExams: [...examCategories.upcomingExams].sort(sortByStartTime),
    completedExams: [...examCategories.completedExams].sort(sortByStartTime).reverse(),
  }), [examCategories]);
  const resultsByExamId = useMemo(() => (
    new Map(results.map((result) => [String(result.examId || ''), result]))
  ), [results]);
  const classStats = useMemo(() => ({
    available: sortedCategories.availableExams.length,
    upcoming: sortedCategories.upcomingExams.length,
    completed: sortedCategories.completedExams.length,
    results: results.length,
    members: members.length,
  }), [members.length, results.length, sortedCategories]);

  const handleLeaveGroup = async () => {
    if (!window.confirm('Leave this group? You will lose access to its exams.')) {
      return;
    }

    try {
      setActionLoading('leave');
      await API.post(`/groups/${id}/leave`);
      navigate(isCreatedGroup ? '/admin' : '/dashboard');
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.error || 'Unable to leave group.',
      });
    } finally {
      setActionLoading('');
    }
  };

  const handleRegenerateJoinCode = async () => {
    const nextCode = window.prompt(
      'Enter a new join code, or leave blank to auto-generate one.',
      '',
    );

    if (nextCode === null) {
      return;
    }

    try {
      setActionLoading('joinCode');
      const payload = nextCode.trim()
        ? { joinCode: nextCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') }
        : {};
      const res = await API.post(`/groups/${id}/join-code/regenerate`, payload);
      setGroup((prev) => (prev ? { ...prev, ...res.data.group } : res.data.group));
      setFeedback({ type: 'success', text: 'Join code updated successfully.' });
      await loadGroup();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.error || 'Unable to update join code.',
      });
    } finally {
      setActionLoading('');
    }
  };

  const handleGenerateInviteLink = async () => {
    try {
      setActionLoading('inviteLink');
      const res = await API.post(`/groups/${id}/invite`);
      const inviteUrl = `${window.location.origin}/join/${res.data.invite.token}`;
      window.prompt('Here is the single-use invite link. Copy and share it:', inviteUrl);
      setFeedback({ type: 'success', text: 'Invite link generated successfully.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Unable to generate invite link.' });
    } finally {
      setActionLoading('');
    }
  };

  const renderStudentContent = () => (
    <>
      <div className='card classroom-detail-hero'>
        <div className='classroom-detail-copy'>
          <Link to='/dashboard' className='classroom-inline-link'>Back to classes</Link>
          <h2>{group.name}</h2>
        </div>


        <button
          type='button '
          className='btn danger'
          onClick={handleLeaveGroup}
          disabled={actionLoading === 'leave'}
          style={{ maxWidth: "200px" }}
        >
          {actionLoading === 'leave' ? (
            <LoadingSpinner inline size='sm' className='loading-spinner--button' label='Leaving...' />
          ) : 'Leave class'}
        </button>
      </div>

      {feedback.text && (
        <div className={`alert ${feedback.type === 'error' ? 'error' : 'success'}`}>
          {feedback.text}
        </div>
      )}

      <div className='classroom-mini-stats'>
        <div className='card classroom-mini-stat'>
          <span>Available</span>
          <strong>{classStats.available}</strong>
        </div>
        <div className='card classroom-mini-stat'>
          <span>Upcoming</span>
          <strong>{classStats.upcoming}</strong>
        </div>
        <div className='card classroom-mini-stat'>
          <span>Completed</span>
          <strong>{classStats.completed}</strong>
        </div>
        <div className='card classroom-mini-stat'>
          <span>Visible results</span>
          <strong>{classStats.results}</strong>
        </div>
      </div>

      <div className='classroom-detail-main'>
        {studentExamSections.map((section) => (
          <section className='card classroom-exam-section' key={section.key}>
            <div className='split classroom-section-head'>
              <div>
                <h3>{section.title}</h3>
                <p className='muted'>{section.description}</p>
              </div>
              <span className='classroom-section-count'>
                {sortedCategories[section.key].length} exam{sortedCategories[section.key].length === 1 ? '' : 's'}
              </span>
            </div>

            {sortedCategories[section.key].length > 0 ? (
              <div className='classroom-exam-grid classroom-exam-grid--wide'>
                {sortedCategories[section.key].map((exam) => {
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
                        <p>{exam.description || 'No exam description provided.'}</p>
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
                              <><strong>Score:</strong> {`${Number(result.percentage || 0).toFixed(0)}% (${result.score}/${result.total} points)`} | <strong>Submitted:</strong> {formatDateTimeLabel(result.submittedAt)}</>
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
                                state={{ from: `/groups/${id}` }}
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
                            <strong>{exam.title}</strong>
                            <span>
                              Opens {formatDateLabel(exam.startTime)} at {formatTimeLabel(exam.startTime)}
                            </span>
                          </div>
                          <Link
                            to={`/exam/${exam._id}`}
                            state={{ from: `/groups/${id}` }}
                            className='btn'
                          >
                            {section.key === 'availableExams' ? 'Take exam' : 'Open lobby'}
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
      </div>
    </>
  );

  return (
    <div className={showAdminControls ? 'dashboard-layout' : 'container'}>
      {showAdminControls && <Sidebar title='Admin Panel' items={adminSidebarItems} />}
      <section className={`dashboard-main ${showAdminControls ? '' : 'classroom-main classroom-main--student'}`.trim()}>
        {loading ? (
          <div className='card'>
            <LoadingSpinner label='Loading group...' minHeight='220px' />
          </div>
        ) : !group ? (
          <div className='card'>{feedback.text || 'Group not found.'}</div>
        ) : (
          showAdminControls ? (
            <>
              <div className='card admin-group-hero' style={{ padding: '24px', marginBottom: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: 700, color: '#111827' }}>{group.name}</h1>
                </div>

                <p style={{ color: '#4b5563', fontSize: '0.95rem', marginBottom: '10px', lineHeight: 1.5, maxWidth: '800px' }}>
                  {group.description || 'This is a detailed description area for the group. Use this space to add specific group-related notes, instructions, or goals.'}
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', marginBottom: '16px', fontWeight: 600, fontSize: '0.7rem', color: '#111827' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Group Code: {group.joinCode}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    Total Exams: {exams.length}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    Total Members: {members.length}
                  </div>
                </div>



                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button type='button' className='btn secondary' onClick={handleRegenerateJoinCode} disabled={actionLoading === 'joinCode'} style={{ backgroundColor: '#4f46e5', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {actionLoading === 'joinCode' ? (
                      <LoadingSpinner inline size='sm' className='loading-spinner--button' label='Updating code...' />
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg> Regenerate Join Code
                      </>
                    )}
                  </button>
                  <button type='button' className='btn secondary' onClick={handleGenerateInviteLink} disabled={actionLoading === 'inviteLink'} style={{ backgroundColor: '#4f46e5', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {actionLoading === 'inviteLink' ? (
                      <LoadingSpinner inline size='sm' className='loading-spinner--button' label='Generating link...' />
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg> Generate Invite Link
                      </>
                    )}
                  </button>
                  <button type='button' className='btn secondary' onClick={handleLeaveGroup} disabled={actionLoading === 'leave'} style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {actionLoading === 'leave' ? (
                      <LoadingSpinner inline size='sm' className='loading-spinner--button' label='Leaving group...' />
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> Leave Group
                      </>
                    )}
                  </button>

                </div>
              </div>

              {feedback.text && (
                <div className={`alert ${feedback.type === 'error' ? 'error' : 'success'}`}>
                  {feedback.text}
                </div>
              )}

              <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', borderBottom: activeTab === 'exams' ? '2px solid #4f46e5' : '2px solid transparent', color: activeTab === 'exams' ? '#4f46e5' : '#6b7280', padding: '12px 16px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                  onClick={() => setActiveTab('exams')}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    Group Exams
                  </span>
                </button>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', borderBottom: activeTab === 'members' ? '2px solid #4f46e5' : '2px solid transparent', color: activeTab === 'members' ? '#4f46e5' : '#6b7280', padding: '12px 16px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                  onClick={() => setActiveTab('members')}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    Members
                  </span>
                </button>
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', borderBottom: activeTab === 'results' ? '2px solid #4f46e5' : '2px solid transparent', color: activeTab === 'results' ? '#4f46e5' : '#6b7280', padding: '12px 16px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                  onClick={() => setActiveTab('results')}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                    Student Results
                  </span>
                </button>
              </div>

              <div className='grid groups-grid' style={{ gridTemplateColumns: '1fr', alignItems: 'start' }}>
                {activeTab === 'members' && (
                  <section className='card' style={{ display: 'flex', flexDirection: 'column', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: '#fff', padding: '0' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0', padding: '20px', fontSize: '1.2rem', color: '#111827' }}>
                      Members
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    </h3>
                    <div className='table-wrap' style={{ borderTop: '1px solid #e5e7eb', padding: '0 20px', margin: 0 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#4b5563' }}>
                            <th style={{ padding: '16px 0', fontWeight: 600 }}>Name</th>
                            <th style={{ padding: '16px 0', fontWeight: 600 }}>Email</th>
                            <th style={{ padding: '16px 0', fontWeight: 600 }}>Role</th>
                            <th style={{ padding: '16px 0', fontWeight: 600 }}>Joined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.length > 0 ? (
                            members.map((member) => {
                              return (
                                <tr key={member._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                  <td style={{ padding: '16px 0', color: '#111827', fontWeight: 500 }}>{member.userId?.name || 'Member'}</td>
                                  <td style={{ padding: '16px 0', color: '#111827', fontWeight: 500 }}>{member.userId?.email || '-'}</td>
                                  <td style={{ padding: '16px 0' }}>
                                    {member.role === 'admin' ? (
                                      <span style={{ backgroundColor: '#d1fae5', color: '#065f46', padding: '4px 10px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>admin</span>
                                    ) : (
                                      <span style={{ color: '#111827', fontWeight: 600 }}>student</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '16px 0', color: '#111827', fontWeight: 500 }}>{member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '-'}</td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan='4' style={{ padding: '24px 0', textAlign: 'center', color: '#6b7280' }}>No members found.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
                      <span style={{ color: '#9ca3af', cursor: 'pointer' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg></span>
                      <span style={{ color: '#9ca3af', cursor: 'pointer' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></span>

                    </div>
                  </section>
                )}

                {activeTab === 'exams' && (
                  <section className='card' style={{ display: 'flex', flexDirection: 'column', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: '#fff', padding: '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px' }}>
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '1.2rem', color: '#111827' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        Group Exams
                      </h3>
                      <button type="button" className="btn secondary" style={{ backgroundColor: '#4f46e5', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '6px', fontSize: '0.85rem' }} onClick={() => navigate('/admin', { state: { section: 'create', groupId: group._id } })}>
                        Create Exam
                      </button>
                    </div>

                    <div className='table-wrap' style={{ borderTop: '1px solid #e5e7eb', padding: '0 20px', margin: 0 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: '#4b5563' }}>
                            <th style={{ padding: '16px 0', fontWeight: 600 }}>Exam</th>
                            <th style={{ padding: '16px 0', fontWeight: 600 }}>Status</th>
                            <th style={{ padding: '16px 0', fontWeight: 600 }}>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {exams.length > 0 ? (
                            exams.map((exam) => (
                              <tr key={exam._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                <td style={{ padding: '16px 0', color: '#111827', fontWeight: 500 }}>
                                  <span
                                    style={{ textDecoration: 'underline', color: '#4f46e5', cursor: 'pointer' }}
                                    onClick={() => navigate('/admin', { state: { section: 'results', examId: exam._id } })}
                                  >
                                    {exam.title}
                                  </span>
                                </td>
                                <td style={{ padding: '16px 0' }}>
                                  {exam.status === 'completed' ? (
                                    <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ backgroundColor: '#059669', color: '#fff', borderRadius: '50%', padding: '2px' }}><polyline points="20 6 9 17 4 12"></polyline></svg>
                                      Completed
                                    </span>
                                  ) : (
                                    <span style={{ color: '#111827', fontWeight: 500, textTransform: 'capitalize' }}>{exam.status}</span>
                                  )}
                                </td>
                                <td style={{ padding: '16px 0', color: '#111827', fontWeight: 500 }}>{new Date(exam.startTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</td>

                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan='4' style={{ padding: '24px 0', textAlign: 'center', color: '#6b7280' }}>No exams in this group.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {activeTab === 'results' && (
                  <div style={{ marginTop: '20px' }}>
                    <AdminResults groupId={group._id} />
                  </div>
                )}
              </div>
            </>
          ) : renderStudentContent()
        )}
      </section>
    </div>
  );
}
