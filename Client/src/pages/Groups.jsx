import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import Sidebar from '../components/Sidebar';

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const sidebarItems = [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Groups', to: '/groups' },
    { label: 'My Exams', to: '/exams' },
  ];

  const loadGroups = async () => {
    try {
      setLoading(true);
      const res = await API.get('/groups/joined');
      setGroups(res.data || []);
    } catch {
      setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  return (
    <div className='dashboard-layout'>
      <Sidebar title='Groups' items={sidebarItems} />
      <section className='dashboard-main'>
        <div className='card groups-hero'>
          <div>
            <h2>Groups</h2>
            <p className='section-subtitle'>
              Open the groups you already belong to and access their members and exams.
            </p>
          </div>
          <div className='groups-hero-meta'>
            <strong>{groups.length}</strong>
            <span>Joined groups</span>
          </div>
        </div>

        {error && <div className='alert error'>{error}</div>}

        <section className='card'>
          <div className='split'>
            <h3>Joined Groups</h3>
            <div className='groups-page-links'>
              <Link to='/dashboard' className='btn secondary'>Student Panel</Link>
            </div>
          </div>
          {loading ? (
            <LoadingSpinner label='Loading groups...' minHeight='160px' />
          ) : (
            <div className='table-wrap'>
              <table>
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Description</th>
                    <th>Joined</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.length > 0 ? (
                    groups.map((group) => (
                      <tr key={group._id}>
                        <td>
                          <strong>{group.name}</strong>
                          <div className='muted'>Code: {group.joinCode}</div>
                        </td>
                        <td>{group.description || 'No description'}</td>
                        <td>{group.joinedAt ? new Date(group.joinedAt).toLocaleDateString() : '-'}</td>
                        <td>
                          <Link to={`/groups/${group._id}`} className='btn secondary'>
                            Open Group
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
          )}
        </section>
      </section>
    </div>
  );
}
