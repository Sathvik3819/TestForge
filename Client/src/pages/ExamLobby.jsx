import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import API from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

function getClientId(examId) {
  const key = `exam:${examId}:clientId`;
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
}

export default function ExamLobby() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [lobby, setLobby] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const clientId = useMemo(() => getClientId(id), [id]);
  const backTarget = location.state?.from || '/dashboard';
  const backLabel = backTarget.startsWith('/groups/') ? 'Back to class' : 'Back to classes';

  useEffect(() => {
    const loadLobby = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await API.get(`/exams/${id}/lobby`);
        setLobby(res.data);
      } catch (err) {
        setError(err.response?.data?.msg || 'Unable to load exam lobby.');
      } finally {
        setLoading(false);
      }
    };
    loadLobby();
  }, [id]);

  const handleStart = async () => {
    try {
      setStarting(true);
      setError('');
      await API.post(`/exams/${id}/start`, { clientId });
      navigate(`/exam/${id}/live`, { state: { clientId } });
    } catch (err) {
      setError(err.response?.data?.msg || 'Unable to start exam.');
    } finally {
      setStarting(false);
    }
  };

  const handleResume = () => {
    navigate(`/exam/${id}/live`, { state: { clientId } });
  };

  return (
    <div className='container'>
      <section className='card exam-lobby-card'>
        {loading ? (
          <LoadingSpinner label='Loading exam lobby...' minHeight='220px' />
        ) : !lobby ? (
          <p>{error || 'Lobby not available.'}</p>
        ) : (
          <>
            <div className='exam-lobby-header'>
              <div>
                <span className='profile-eyebrow'>Exam Lobby</span>
                <h2>{lobby.title}</h2>
                <p className='section-subtitle'>{lobby.description || 'Read the instructions before entering the exam.'}</p>
              </div>
              <div className='exam-lobby-meta'>
                <strong>{lobby.duration} min</strong>
                <span>Total Marks: {lobby.totalMarks}</span>
                <span>Status: {lobby.status}</span>
              </div>
            </div>

            <div className='grid two-col exam-lobby-grid'>
              <div className='card exam-lobby-panel'>
                <h3>Exam Information</h3>
                <div className='info-stack'>
                  <div className='info-item'><span className='info-label'>Start Time</span><span className='info-value'>{new Date(lobby.startTime).toLocaleString()}</span></div>
                  <div className='info-item'><span className='info-label'>End Time</span><span className='info-value'>{new Date(lobby.endTime).toLocaleString()}</span></div>
                  <div className='info-item'><span className='info-label'>Attempts</span><span className='info-value'>{lobby.attemptsUsed}/{lobby.maxAttempts}</span></div>
                  <div className='info-item'><span className='info-label'>Group Access</span><span className='info-value'>{lobby.membership ? 'Verified' : 'Not a member'}</span></div>
                </div>
              </div>

              <div className='card exam-lobby-panel'>
                <h3>Rules</h3>
                <ul className='rule-list'>
                  {(lobby.rules || []).map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
            </div>

            {error && <div className='alert error'>{error}</div>}

            <div className='exam-lobby-actions'>
              <button type='button' className='btn secondary' onClick={() => navigate(backTarget)}>
                {backLabel}
              </button>
              {lobby.hasActiveSession ? (
                <button type='button' className='btn' onClick={handleResume}>
                  Resume Exam
                </button>
              ) : (
                <button type='button' className='btn' onClick={handleStart} disabled={!lobby.canStart || starting}>
                  {starting ? (
                    <LoadingSpinner inline size='sm' className='loading-spinner--button' label='Starting...' />
                  ) : 'Start Exam'}
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
