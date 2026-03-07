import { useEffect, useMemo, useState } from 'react';
import API from '../api';
import Sidebar from '../components/Sidebar';
import ResultChart from '../components/ResultChart';

const adminSidebar = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'Create Exam', to: '/create-exam' },
  { label: 'Manage Exams', to: '/exams' },
  { label: 'Candidates', to: '/monitoring' },
  { label: 'Monitoring', to: '/monitoring' },
  { label: 'Results', to: '/results' },
];

export default function AdminDashboard() {
  const [exams, setExams] = useState([]);
  const [monitorRows, setMonitorRows] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [examRes, monitorRes] = await Promise.all([
          API.get('/exams'),
          API.get('/exams/monitor/live'),
        ]);
        setExams(examRes.data || []);
        setMonitorRows(monitorRes.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  const cards = useMemo(() => {
    const ongoing = monitorRows.filter((item) => !item.submitted).length;
    const submitted = monitorRows.filter((item) => item.submitted).length;
    return {
      totalExams: exams.length,
      activeCandidates: monitorRows.length,
      ongoingExams: ongoing,
      submittedSessions: submitted,
    };
  }, [exams, monitorRows]);

  return (
    <div className='dashboard-layout'>
      <Sidebar title='Admin Panel' items={adminSidebar} />
      <section className='dashboard-main'>
        <h2>Admin Dashboard</h2>
        <div className='stats-grid'>
          <div className='card stat-card'>
            <p>Total Exams</p>
            <strong>{cards.totalExams}</strong>
          </div>
          <div className='card stat-card'>
            <p>Active Candidates</p>
            <strong>{cards.activeCandidates}</strong>
          </div>
          <div className='card stat-card'>
            <p>Ongoing Exams</p>
            <strong>{cards.ongoingExams}</strong>
          </div>
          <div className='card stat-card'>
            <p>Submitted Sessions</p>
            <strong>{cards.submittedSessions}</strong>
          </div>
        </div>

        <div className='grid'>
          <ResultChart
            title='Exam Participation'
            data={[
              { label: 'Mon', value: 22 },
              { label: 'Tue', value: 18 },
              { label: 'Wed', value: 30 },
              { label: 'Thu', value: 26 },
              { label: 'Fri', value: 34 },
            ]}
          />
          <ResultChart
            title='Average Score'
            data={[
              { label: 'DBMS', value: 76 },
              { label: 'OS', value: 69 },
              { label: 'CN', value: 81 },
              { label: 'DSA', value: 73 },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
