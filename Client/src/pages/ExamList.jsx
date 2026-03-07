import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';
import Sidebar from '../components/Sidebar';

const sidebarItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'My Exams', to: '/exams' },
];

export default function ExamList() {
  const [examCategories, setExamCategories] = useState({ availableExams: [], upcomingExams: [], completedExams: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await API.get('/exams');
        setExamCategories(res.data || { availableExams: [], upcomingExams: [], completedExams: [] });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchExams();
  }, []);

  const sections = [
    { title: 'Available Exams', rows: examCategories.availableExams || [] },
    { title: 'Upcoming Exams', rows: examCategories.upcomingExams || [] },
    { title: 'Completed Exams', rows: examCategories.completedExams || [] },
  ];

  return (
    <div className='dashboard-layout'>
      <Sidebar title='Student Panel' items={sidebarItems} />
      <section className='dashboard-main'>
        <h2>My Exams</h2>
        {sections.map((section) => (
          <section className='card' key={section.title}>
            <h3>{section.title}</h3>
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
                    {section.rows.length > 0 ? (
                      section.rows.map((exam) => (
                        <tr key={exam._id}>
                          <td>{exam.title}</td>
                          <td>{new Date(exam.startTime).toLocaleString()}</td>
                          <td>{exam.duration} min</td>
                          <td>
                            {section.title === 'Completed Exams' ? (
                              <Link className='btn secondary' to={`/exam/${exam._id}/results`}>
                                View Results
                              </Link>
                            ) : (
                              <Link className='btn' to={`/exam/${exam._id}`}>
                                Open Lobby
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan='4'>No exams in this section.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </section>
    </div>
  );
}
