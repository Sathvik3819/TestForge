import { useState, useEffect } from 'react';
import API from '../api';

export default function Admin() {
  const [exams, setExams] = useState([]);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState(30);
  const [startTime, setStartTime] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [selectedExam, setSelectedExam] = useState(null);
  const [questionText, setQuestionText] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correct, setCorrect] = useState('');

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await API.get('/exams');
        setExams(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchExams();
  }, []);

  const refreshExams = async () => {
    const res = await API.get('/exams');
    setExams(res.data);
  };

  const createExam = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      await API.post('/exams', { title, duration, startTime });
      setSuccess('Exam created successfully.');
      setTitle('');
      setDuration(30);
      setStartTime('');
      await refreshExams();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to create exam');
    }
  };

  const addQuestion = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      await API.post(`/exams/${selectedExam}/questions`, {
        text: questionText,
        options: options.map((option) => ({ text: option })),
        correctAnswer: correct,
      });

      setSuccess('Question added successfully.');
      setQuestionText('');
      setOptions(['', '', '', '']);
      setCorrect('');
      await refreshExams();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.msg || 'Failed to add question');
    }
  };

  const selectedExamData = exams.find((exam) => exam._id === selectedExam);

  return (
    <div className='container'>
      <section>
        <h2 className='section-title'>Create Exam</h2>
        <p className='section-subtitle'>Create exams and manage question banks.</p>
      </section>

      {error && <div className='alert error'>{error}</div>}
      {success && <div className='alert success'>{success}</div>}

      <section className='grid'>
        <article className='card fade-up'>
          <h3>Create New Exam</h3>
          <form onSubmit={createExam}>
            <div>
              <label htmlFor='exam-title'>Exam Title</label>
              <input
                id='exam-title'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='Mathematics Midterm'
                required
              />
            </div>

            <div>
              <label htmlFor='duration'>Duration (minutes)</label>
              <input
                id='duration'
                type='number'
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                min='1'
                required
              />
            </div>

            <div>
              <label htmlFor='start-time'>Start Time</label>
              <input
                id='start-time'
                type='datetime-local'
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>

            <button type='submit' className='btn'>
              Create Exam
            </button>
          </form>
        </article>

        <article className='card fade-up delay-1'>
          <h3>Add Question</h3>
          <form onSubmit={addQuestion}>
            <div>
              <label htmlFor='select-exam'>Select Exam</label>
              <select
                id='select-exam'
                value={selectedExam || ''}
                onChange={(e) => setSelectedExam(e.target.value)}
                required
              >
                <option value=''>Choose an exam</option>
                {exams.map((exam) => (
                  <option key={exam._id} value={exam._id}>
                    {exam.title}
                  </option>
                ))}
              </select>
            </div>

            {selectedExamData && (
              <p className='muted'>Questions currently: {selectedExamData.questions?.length || 0}</p>
            )}

            {selectedExam && (
              <>
                <div>
                  <label htmlFor='question-text'>Question</label>
                  <textarea
                    id='question-text'
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder='Enter the question text'
                    required
                  />
                </div>

                {options.map((option, idx) => (
                  <div key={idx}>
                    <label htmlFor={`option-${idx}`}>Option {idx + 1}</label>
                    <input
                      id={`option-${idx}`}
                      value={option}
                      onChange={(e) => {
                        const updated = [...options];
                        updated[idx] = e.target.value;
                        setOptions(updated);
                      }}
                      placeholder={`Enter option ${idx + 1}`}
                      required
                    />
                  </div>
                ))}

                <div>
                  <label htmlFor='correct-answer'>Correct Answer</label>
                  <select
                    id='correct-answer'
                    value={correct}
                    onChange={(e) => setCorrect(e.target.value)}
                    required
                  >
                    <option value=''>Select correct answer</option>
                    {options.map(
                      (option, idx) =>
                        option && (
                          <option key={idx} value={option}>
                            {option}
                          </option>
                        ),
                    )}
                  </select>
                </div>

                <button type='submit' className='btn accent'>
                  Add Question
                </button>
              </>
            )}
          </form>
        </article>
      </section>

      <section>
        <h3 className='section-title'>Existing Exams ({exams.length})</h3>
        {exams.length > 0 ? (
          <div className='grid'>
            {exams.map((exam) => (
              <article key={exam._id} className='card'>
                <h4>{exam.title}</h4>
                <p className='muted'>Duration: {exam.duration} minutes</p>
                <p className='muted'>Questions: {exam.questions?.length || 0}</p>
                <p className='muted'>ID: {exam._id}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className='card'>
            <p>No exams created yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}
