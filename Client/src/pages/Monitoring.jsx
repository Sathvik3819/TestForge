import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import API from '../api';

const adminSidebar = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'Create Exam', to: '/create-exam' },
  { label: 'Manage Exams', to: '/exams' },
  { label: 'Candidates', to: '/monitoring' },
  { label: 'Monitoring', to: '/monitoring' },
  { label: 'Results', to: '/results' },
  { label: 'Payments', to: '/results' },
];

export default function Monitoring() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const fetchRows = async () => {
      try {
        const res = await API.get('/exams/monitor/live');
        setRows(res.data || []);
      } catch (err) {
        console.error(err);
      }
    };

    fetchRows();
    const interval = setInterval(fetchRows, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className='dashboard-layout'>
      <Sidebar title='Admin Panel' items={adminSidebar} />
      <section className='dashboard-main'>
        <h2>Live Monitoring</h2>
        <div className='card table-wrap'>
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Exam</th>
                <th>Status</th>
                <th>Warnings</th>
                <th>Time Left</th>
                <th>Flagged</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr
                    key={row.sessionId}
                    className={row.flagged ? 'flagged-row' : ''}
                  >
                    <td>{row.user?.name || row.user?.email || 'Candidate'}</td>
                    <td>{row.exam?.title || '—'}</td>
                    <td>{row.submitted ? 'Submitted' : 'Active'}</td>
                    <td>{row.warningsCount}</td>
                    <td>{Math.max(0, Math.floor((row.timeLeftMs || 0) / 60000))} min</td>
                    <td>{row.flagged ? '⚠️' : ''}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan='6'>No live candidates.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
