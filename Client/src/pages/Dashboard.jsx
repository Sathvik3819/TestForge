import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';
import Sidebar from '../components/Sidebar';

const sidebarItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'My Exams', to: '/exams' },
];

export default function UserDashboard() {
  const [examCategories, setExamCategories] = useState({ availableExams: [], upcomingExams: [], completedExams: [] });
  const [groups, setGroups] = useState([]);
  const [joinCode, setJoinCode] = useState('');
  const [groupStatus, setGroupStatus] = useState('');

  const fetchData = async () => {
    try {
      const [examRes, groupRes] = await Promise.all([
        API.get('/exams'),
        API.get('/groups/my'),
      ]);
      setExamCategories(examRes.data || { availableExams: [], upcomingExams: [], completedExams: [] });
      setGroups(groupRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const metrics = useMemo(() => {
    const upcoming = examCategories.upcomingExams;
    const completed = examCategories.completedExams;
    return {
      attempted: completed.length,
      upcoming: upcoming.length,
      completed: completed.length,
      avgScore: completed.length ? 78 : 0,
      upcomingList: upcoming.slice(0, 6),
      groupList: groups.slice(0, 5),
    };
  }, [examCategories, groups]);

  const handleJoinGroup = async (e) => {
    e.preventDefault();
    setGroupStatus('');
    try {
      await API.post('/groups/join', { joinCode });
      setJoinCode('');
      setGroupStatus('Joined group successfully.');
      fetchData();
    } catch (err) {
      setGroupStatus(err.response?.data?.error || 'Unable to join group');
    }
  };

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
                          Open Lobby
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

        <div className='grid groups-grid'>
          <section className='card'>
            <h3>Join Group</h3>
            <form onSubmit={handleJoinGroup} className='auth-form'>
              <div>
                <label>Join Code</label>
                <input
                  required
                  value={joinCode}
                  placeholder='Enter group code'
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                />
              </div>
              <button type='submit' className='btn'>Join Group</button>
            </form>
            {groupStatus && (
              <div className={`alert ${groupStatus.toLowerCase().includes('successfully') ? 'success' : 'error'}`}>
                {groupStatus}
              </div>
            )}
          </section>

          <section className='card'>
          <div className='split'>
            <h3>Joined Groups</h3>
            <Link to='/groups' className='btn secondary'>Manage Groups</Link>
          </div>
          <div className='table-wrap'>
            <table>
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Role</th>
                  <th>Join Code</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {metrics.groupList.length > 0 ? (
                  metrics.groupList.map((group) => (
                    <tr key={group._id}>
                      <td>{group.name}</td>
                      <td>{group.membershipRole || 'student'}</td>
                      <td>{group.joinCode}</td>
                      <td>
                        <Link to={`/groups/${group._id}`} className='btn secondary'>
                          View Group
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan='4'>No groups joined yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </section>
        </div>
      </section>
    </div>
  );
}
