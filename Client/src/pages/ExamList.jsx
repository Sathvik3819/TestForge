import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';

export default function ExamList() {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await API.get('/exams');
        setExams(res.data || []);
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
      <section className='card'>
        <h2>My Exams</h2>
        {loading ? (
          <p className='muted'>Loading exams...</p>
        ) : (
          <div className='table-wrap'>
            <table>
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {exams.length > 0 ? (
                  exams.map((exam) => {
                    const isActive = exam.status === 'Active';
                    const isCompleted = exam.status === 'Completed';
                    return (
                      <tr key={exam._id}>
                        <td>{exam.title}</td>
                        <td>{new Date(exam.startTime).toLocaleString()}</td>
                        <td>{exam.duration} min</td>
                        <td>
                          {isCompleted ? (
                            <Link className='btn secondary' to={`/exam/${exam._id}/results`}>
                              View Results
                            </Link>
                          ) : isActive ? (
                            <Link className='btn' to={`/exam/${exam._id}`}>
                              Start Exam
                            </Link>
                          ) : (
                            <span className='status-pill'>{exam.status || 'Scheduled'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan='4'>No exams found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
