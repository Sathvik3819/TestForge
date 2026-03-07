import { useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';

export default function AdminGroups({ groups, onRefresh }) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [status, setStatus] = useState('');

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setStatus('');
    try {
      await API.post('/groups', form);
      setForm({ name: '', description: '' });
      setStatus('Group created successfully.');
      onRefresh?.();
    } catch (err) {
      setStatus(err.response?.data?.error || 'Unable to create group');
    }
  };

  return (
    <section className='admin-section'>
      <h2>Groups</h2>
      <div className='grid groups-grid'>
        <section className='card'>
          <h3>Create Group</h3>
          <form onSubmit={handleCreateGroup} className='auth-form'>
            <div>
              <label>Group Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label>Description</label>
              <textarea
                rows='3'
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <button type='submit' className='btn'>Create Group</button>
          </form>
          {status && (
            <div className={`alert ${status.toLowerCase().includes('successfully') ? 'success' : 'error'}`}>
              {status}
            </div>
          )}
        </section>

        <section className='card'>
          <div className='split'>
            <h3>My Groups</h3>
            <Link to='/groups' className='btn secondary'>Open Full View</Link>
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
                {groups.length > 0 ? (
                  groups.map((group) => (
                    <tr key={group._id}>
                      <td>{group.name}</td>
                      <td>{group.membershipRole || 'admin'}</td>
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
                    <td colSpan='4'>No groups created yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
