import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import API from '../api';

export default function ExamPage() {
  const { id } = useParams();
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [warnings, setWarnings] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const res = await API.get(`/exams/${id}`);
        setExam(res.data);

        if (res.data.startTime) {
          const end = new Date(res.data.startTime).getTime() + res.data.duration * 60000;
          setTimeLeft(end - Date.now());
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchExam();

    const handleVisibility = () => {
      if (document.hidden) {
        setWarnings((prev) => [...prev, 'Tab switched during exam']);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [id]);

  useEffect(() => {
    if (timeLeft === null || submitted) return;

    const timer = setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1000) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }

        return current - 1000;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, submitted]);

  const handleChange = (qid, option) => {
    setAnswers((prev) => ({ ...prev, [qid]: option }));
  };

  const handleSubmit = async () => {
    try {
      await API.post(`/exams/${id}/submit`, { answers });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    }
  };

  if (!exam) {
    return (
      <div className='container'>
        <div className='card'>
          <p>Loading exam...</p>
        </div>
      </div>
    );
  }

  const safeTime = timeLeft || 0;
  const timeLeftMinutes = Math.floor(safeTime / 60000);
  const timeLeftSeconds = Math.floor((safeTime % 60000) / 1000);
  const isLowTime = safeTime < 300000;
  const isVeryLowTime = safeTime < 60000;

  if (submitted) {
    return (
      <div className='container'>
        <div className='card fade-up'>
          <h2 className='section-title'>Exam Submitted</h2>
          <p className='section-subtitle'>Your responses were saved successfully.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='container'>
      <section className='card split'>
        <div>
          <h2 className='section-title'>{exam.title}</h2>
          <p className='section-subtitle'>
            Duration: {exam.duration} minutes | Questions: {exam.questions?.length || 0}
          </p>
        </div>

        <div className={`timer ${isVeryLowTime ? 'danger' : isLowTime ? 'warning' : ''}`}>
          {timeLeftMinutes}m {timeLeftSeconds}s
        </div>
      </section>

      <section className='list'>
        {exam.questions && exam.questions.length > 0 ? (
          exam.questions.map((q, idx) => (
            <article key={q._id} className='question-card' data-index={idx + 1}>
              <p className='question-title'>Q{idx + 1}. {q.text}</p>
              {q.options.map((opt, optIdx) => (
                <label key={optIdx} className='option-row'>
                  <input
                    type='radio'
                    name={q._id}
                    value={opt.text}
                    onChange={() => handleChange(q._id, opt.text)}
                    checked={answers[q._id] === opt.text}
                  />
                  {opt.text}
                </label>
              ))}
            </article>
          ))
        ) : (
          <div className='card'>
            <p>No questions available.</p>
          </div>
        )}
      </section>

      <button onClick={handleSubmit} className='btn accent'>
        Submit Exam
      </button>

      {warnings.length > 0 && (
        <section className='warn-box'>
          <h4>Warnings</h4>
          <ul className='list'>
            {warnings.map((warning, i) => (
              <li key={i} className='list-item'>
                {warning}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}