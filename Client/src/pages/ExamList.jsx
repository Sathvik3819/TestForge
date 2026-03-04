import { useEffect, useState } from 'react';
import API from '../api';
import { Link } from 'react-router-dom';

export default function ExamList() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await API.get('/exams');
        setExams(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, []);

  return (
    <div className='container'>
      <section>
        <h2 className='section-title'>Available Exams</h2>
        <p className='section-subtitle'>Choose an exam and begin when ready.</p>
      </section>

      {loading ? (
        <div className='card'>
          <p>Loading exams...</p>
        </div>
      ) : exams.length > 0 ? (
        <div className='grid'>
          {exams.map((exam) => (
            <article key={exam._id} className='card fade-up'>
              <h3>{exam.title}</h3>
              <div className='list'>
                <p className='muted'>Duration: {exam.duration} minutes</p>
                <p className='muted'>Questions: {exam.questions?.length || 0}</p>
              </div>
              <Link to={`/exam/${exam._id}`} className='btn'>
                Start Exam
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className='card'>
          <p>No exams available yet.</p>
        </div>
      )}
    </div>
  );
}