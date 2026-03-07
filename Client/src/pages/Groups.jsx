import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContext';

export default function Groups() {
  const { user } = useContext(AuthContext);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const sidebarItems = [
    { label: 'Dashboard', to: '/dashboard' },
    ...(user?.role === 'admin' ? [{ label: 'Admin Panel', to: '/admin' }] : []),
    { label: 'Groups', to: '/groups' },
    { label: 'My Exams', to: '/exams' },
  ];

  const loadGroups = async () => {
    try {
      setLoading(true);
      const res = await API.get('/groups/my');
      setGroups(res.data || []);
    } catch (err) {
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
            <h3>My Groups</h3>
            <div className='groups-page-links'>
              <Link to='/dashboard' className='btn secondary'>Student Panel</Link>
              {user?.role === 'admin' && (
                <Link to='/admin' className='btn secondary'>Admin Panel</Link>
              )}
            </div>
          </div>
          {loading ? (
            <p className='muted'>Loading groups...</p>
          ) : (
            <div className='table-wrap'>
              <table>
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Description</th>
                    <th>Role</th>
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
                        <td>{group.membershipRole || 'student'}</td>
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
                      <td colSpan='5'>No groups joined yet.</td>
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
