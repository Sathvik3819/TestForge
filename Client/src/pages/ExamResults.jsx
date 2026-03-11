import { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import API from '../api';
import { AuthContext } from '../context/AuthContext';
import ResultChart from '../components/ResultChart';

export default function ExamResults() {
  const { examId } = useParams();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const backTarget = location.state?.from || '/dashboard';
  const backLabel = backTarget.startsWith('/groups/') ? 'Back to class' : 'Back to classes';

  useEffect(() => {
    const fetchResults = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await API.get(`/exams/${examId}/results`);
        setResult(res.data);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.msg || err.message || 'Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchResults();
    }
  }, [examId, user]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className='card'>
          <p>Loading results...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className='card'>
          <p className='error'>{error}</p>
          <div style={{ marginTop: '1rem' }}>
            <Link to={backTarget} className='btn secondary'>
              {backLabel}
            </Link>
          </div>
        </div>
      );
    }

    if (!result) {
      return (
        <div className='card'>
          <p>No results available</p>
          <div style={{ marginTop: '1rem' }}>
            <Link to={backTarget} className='btn secondary'>
              {backLabel}
            </Link>
          </div>
        </div>
      );
    }

    return (
      <>
        <section className='card'>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <h2 style={{ margin: 0 }}>{result.examTitle}</h2>
            <Link to={backTarget} className='btn secondary'>
              {backLabel}
            </Link>
          </div>

          <div className='result-score-grid'>
            <div>
              <p>Score</p>
              <strong>
                {result.score} / {result.totalMarks}
              </strong>
            </div>
            <div>
              <p>Percentage</p>
              <strong>{result.percentage.toFixed(2)}%</strong>
            </div>
            <div>
              <p>Accuracy</p>
              <strong>{result.accuracy}%</strong>
            </div>
            <div>
              <p>Time Taken</p>
              <strong>{result.timeTakenMinutes} min</strong>
            </div>
          </div>
        </section>

        <section className='card'>
          <h3>Test Statistics</h3>
          <div className='result-stats-grid'>
            <div className='stat-item'>
              <div className='stat-label'>Correct Answers</div>
              <div className='stat-value correct'>{result.correctAnswers}</div>
            </div>
            <div className='stat-item'>
              <div className='stat-label'>Wrong Answers</div>
              <div className='stat-value wrong'>{result.wrongAnswers}</div>
            </div>
            <div className='stat-item'>
              <div className='stat-label'>Unattempted</div>
              <div className='stat-value unattempted'>{result.unattempted}</div>
            </div>
            <div className='stat-item'>
              <div className='stat-label'>Warnings</div>
              <div className='stat-value warnings'>{result.warningsCount}</div>
            </div>
          </div>
        </section>

        <section className='grid'>
          <ResultChart
            title='Answer Distribution'
            data={[
              { label: 'Correct', value: result.correctAnswers },
              { label: 'Wrong', value: result.wrongAnswers },
              { label: 'Unattempted', value: result.unattempted },
            ]}
          />
        </section>

        <section className='card response-sheet'>
          <h3>Response Sheet</h3>
          <div className='response-list'>
            {result.responseSheet.map((item, idx) => (
              <div
                key={item.questionId}
                className={`response-item ${
                  item.isCorrect ? 'correct' : item.userAnswer === null ? 'unattempted' : 'wrong'
                }`}
              >
                <div className='response-header'>
                  <div className='question-no'>Q{idx + 1}</div>
                  <div className='question-status'>
                    {item.isCorrect ? (
                      <span className='badge correct'>Correct</span>
                    ) : item.userAnswer === null ? (
                      <span className='badge unattempted'>Unattempted</span>
                    ) : (
                      <span className='badge wrong'>Wrong</span>
                    )}
                  </div>
                  <div className='marks'>
                    {item.marksObtained > 0 ? (
                      <span className='marks-positive'>+{item.marksObtained.toFixed(2)}</span>
                    ) : item.marksObtained === 0 ? (
                      <span className='marks-zero'>0</span>
                    ) : (
                      <span className='marks-negative'>{item.marksObtained.toFixed(2)}</span>
                    )}
                  </div>
                </div>

                <div className='question-text'>
                  <strong>{item.question}</strong>
                </div>

                <div className='options-list'>
                  {item.options.map((option, optIdx) => {
                    const isCorrectOption = option === item.correctAnswer;
                    const isUserOption = option === item.userAnswer;

                    return (
                      <div
                        key={optIdx}
                        className={`option ${isCorrectOption ? 'correct' : ''} ${
                          isUserOption && !isCorrectOption ? 'selected-wrong' : ''
                        } ${isUserOption && isCorrectOption ? 'selected-correct' : ''}`}
                      >
                        <span className='option-label'>{String.fromCharCode(65 + optIdx)}.</span>
                        <span className='option-text'>{option}</span>
                        {isCorrectOption && !isUserOption && (
                          <span className='option-indicator'>Correct</span>
                        )}
                        {isUserOption && isCorrectOption && (
                          <span className='option-indicator'>Your Answer</span>
                        )}
                        {isUserOption && !isCorrectOption && (
                          <span className='option-indicator'>Your Answer</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </>
    );
  };

  return (
    <div className='container'>
      <section className='dashboard-main classroom-main classroom-main--student'>{renderContent()}</section>
    </div>
  );
}
