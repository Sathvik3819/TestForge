import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import API from '../api';
import ExamTimer from '../components/ExamTimer';
import QuestionCard from '../components/QuestionCard';
import { createAuthedSocket } from '../socket';

function getClientId(examId, fallback) {
  const key = `exam:${examId}:clientId`;
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = fallback || crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
}

export default function ExamPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [exam, setExam] = useState(null);
  const [session, setSession] = useState(null);
  const [answers, setAnswers] = useState({});
  const [marked, setMarked] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [warningPopup, setWarningPopup] = useState('');
  const [loadError, setLoadError] = useState('');
  const socketRef = useRef(null);
  const clientIdRef = useRef(getClientId(id, location.state?.clientId));

  useEffect(() => {
    const init = async () => {
      try {
        setLoadError('');
        const [examRes, sessionRes] = await Promise.all([
          API.get(`/exams/${id}`),
          API.get(`/exams/${id}/session`),
        ]);
        setExam(examRes.data);
        setSession(sessionRes.data);
        const local = localStorage.getItem(`exam:${id}:answers`);
        const localAnswers = local ? JSON.parse(local) : {};
        setAnswers({ ...(sessionRes.data.answers || {}), ...localAnswers });
        setWarnings(sessionRes.data.warnings || []);
        setTimeLeftMs(sessionRes.data.timeLeftMs || 0);
      } catch (err) {
        setLoadError(err.response?.data?.msg || 'Open the exam from the lobby before starting.');
      }
    };
    init();
  }, [id]);

  useEffect(() => {
    if (!exam || !session || session.submitted) return;

    const socket = createAuthedSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('exam:join', { examId: id, clientId: clientIdRef.current });
    });

    socket.on('exam:state', (payload) => {
      setSession((prev) => ({ ...prev, ...payload }));
      setTimeLeftMs(payload.timeLeftMs || 0);
      setWarnings(payload.warnings || []);
      setAnswers((prev) => ({ ...payload.resumeAnswers, ...prev }));
    });

    socket.on('exam:timer', (payload) => {
      setTimeLeftMs(payload.timeLeftMs || 0);
    });

    socket.on('exam:warning:ack', (payload) => {
      setSession((prev) => ({ ...prev, flagged: payload.flagged }));
    });

    socket.on('exam:submitted', () => {
      localStorage.removeItem(`exam:${id}:answers`);
      navigate('/results');
    });

    socket.on('exam:error', (payload) => {
      setLoadError(payload?.msg || 'Socket connection failed for this exam.');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [exam, session?.submitted, id, navigate]);

  useEffect(() => {
    if (!session || session.submitted || Object.keys(answers).length === 0) return;

    const autoSave = setInterval(async () => {
      try {
        await API.post(`/exams/${id}/save`, { answers });
      } catch (err) {
        console.warn('Auto-save failed:', err.message);
      }
    }, 15000); // Auto-save every 15 seconds

    return () => clearInterval(autoSave);
  }, [id, session, answers]);

  useEffect(() => {
    const onVisibility = async () => {
      if (!document.hidden) return;
      const warningText = 'Warning: tab switch detected';
      setWarningPopup(warningText);
      setTimeout(() => setWarningPopup(''), 2500);
      try {
        if (socketRef.current?.connected) {
          socketRef.current.emit('exam:warning', {
            examId: id,
            type: 'tab_switch',
            message: warningText,
          });
        } else {
          const res = await API.post(`/exams/${id}/warnings`, {
            type: 'tab_switch',
            message: warningText,
          });
          setWarnings(res.data.warnings || []);
          if (res.data.submitted) {
            navigate('/results');
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    const onBeforeUnload = (e) => {
      if (!session || session.submitted) return;
      API.post(`/exams/${id}/warnings`, {
        type: 'page_refresh',
        message: 'Warning: page refresh detected during exam',
      })
        .then((res) => {
          if (res.data.submitted) {
            navigate('/results');
          }
        })
        .catch((err) => console.warn('Failed to send refresh warning:', err.message));

      // Show browser confirmation
      e.preventDefault();
      e.returnValue = 'Are you sure? This will end your exam session.';
      return 'Are you sure? This will end your exam session.';
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [id, session]);

  const currentQuestion = exam?.questions?.[currentIndex];

  const saveAnswer = async (questionId, value) => {
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    localStorage.setItem(`exam:${id}:answers`, JSON.stringify(next));
    if (socketRef.current?.connected) {
      socketRef.current.emit('exam:answer', { examId: id, answers: { [questionId]: value } });
    }
  };

  const handleSubmit = async (reason = 'manual_submit') => {
    try {
      if (socketRef.current?.connected) {
        socketRef.current.emit('exam:submit', { examId: id, answers, reason });
      } else {
        await API.post(`/exams/${id}/submit`, { answers, reason });
        localStorage.removeItem(`exam:${id}:answers`);
        navigate('/results');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const numbers = useMemo(() => exam?.questions?.map((_, idx) => idx) || [], [exam]);

  if (!exam || !currentQuestion) {
    return (
      <div className='container'>
        <div className='card'>
          {loadError ? (
            <>
              <h3>Exam cannot be started</h3>
              <p className='section-subtitle'>{loadError}</p>
              <p className='muted'>
                Check exam schedule/publish status and try again in the allowed time window.
              </p>
            </>
          ) : (
            'Loading exam...'
          )}
        </div>
      </div>
    );
  }

  return (
    <div className='exam-layout'>
      {warningPopup && <div className='warning-popup'>{warningPopup}</div>}

      <aside className='exam-left card'>
        <h3>Questions</h3>
        <div className='question-nav-grid'>
          {numbers.map((idx) => (
            <button
              type='button'
              key={idx}
              className={`qnav-btn ${currentIndex === idx ? 'active' : ''} ${marked[idx] ? 'marked' : ''}`}
              onClick={() => setCurrentIndex(idx)}
            >
              Q{idx + 1}
            </button>
          ))}
        </div>
      </aside>

      <main className='exam-center card'>
        <QuestionCard
          question={currentQuestion}
          index={currentIndex}
          selected={answers[currentQuestion._id]}
          onSelect={(value) => saveAnswer(currentQuestion._id, value)}
        />

        <div className='exam-actions'>
          <button
            type='button'
            className='btn secondary'
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          >
            Prev
          </button>
          <button
            type='button'
            className='btn secondary'
            onClick={() => setCurrentIndex((prev) => Math.min(numbers.length - 1, prev + 1))}
          >
            Next
          </button>
          <button
            type='button'
            className='btn ghost'
            onClick={() => setMarked((prev) => ({ ...prev, [currentIndex]: !prev[currentIndex] }))}
          >
            Mark for Review
          </button>
          <button type='button' className='btn danger' onClick={handleSubmit}>
            Submit
          </button>
        </div>
      </main>

      <aside className='exam-right card'>
        <ExamTimer timeLeftMs={timeLeftMs} />
        <h4>Warnings ({warnings.length})</h4>
        <ul className='warning-list'>
          {warnings.slice(-6).map((warn, idx) => (
            <li key={`${warn.type}-${idx}`}>{warn.message || warn.type}</li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
