import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';
import Sidebar from '../components/Sidebar';

const sidebarItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'My Exams', to: '/exams' },
  { label: 'Results', to: '/results' },
  { label: 'Payments', to: '/results' },
  { label: 'Profile', to: '/dashboard' },
];

export default function UserDashboard() {
  const [exams, setExams] = useState([]);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await API.get('/exams');
        setExams(res.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchExams();
  }, []);

  const metrics = useMemo(() => {
    const now = Date.now();
    const upcoming = exams.filter((exam) => new Date(exam.startTime).getTime() > now);
    const completed = exams.filter((exam) => new Date(exam.startTime).getTime() <= now);
    return {
      attempted: completed.length,
      upcoming: upcoming.length,
      completed: completed.length,
      avgScore: completed.length ? 78 : 0,
      upcomingList: upcoming.slice(0, 6),
    };
  }, [exams]);

  return (
    <div className='dashboard-layout'>
      <Sidebar title='Student Panel' items={sidebarItems} />
      <section className='dashboard-main'>
        <h2>User Dashboard</h2>
        <div className='stats-grid'>
          <div className='card stat-card'>
            <p>Exams Attempted</p>
            <strong>{metrics.attempted}</strong>
          </div>
          <div className='card stat-card'>
            <p>Upcoming Exams</p>
            <strong>{metrics.upcoming}</strong>
          </div>
          <div className='card stat-card'>
            <p>Completed Exams</p>
            <strong>{metrics.completed}</strong>
          </div>
          <div className='card stat-card'>
            <p>Average Score</p>
            <strong>{metrics.avgScore}%</strong>
          </div>
        </div>

        <div className='card'>
          <h3>Upcoming Exams</h3>
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
                {metrics.upcomingList.length > 0 ? (
                  metrics.upcomingList.map((exam) => (
                    <tr key={exam._id}>
                      <td>{exam.title}</td>
                      <td>{new Date(exam.startTime).toLocaleDateString()}</td>
                      <td>{exam.duration} min</td>
                      <td>
                        <Link to={`/exam/${exam._id}`} className='btn'>
                          Start
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan='4'>No upcoming exams.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
