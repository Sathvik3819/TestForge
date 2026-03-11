import { useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';

export default function AdminGroups({ groups, onRefresh }) {
  const [form, setForm] = useState({ name: '', description: '', joinCode: '', maxMembers: 200 });
  const [status, setStatus] = useState({ type: '', text: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);

  const resetForm = () => {
    setForm({ name: '', description: '', joinCode: '', maxMembers: 200 });
  };

  const openCreateModal = () => {
    setStatus({ type: '', text: '' });
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setStatus({ type: '', text: '' });
    try {
      await API.post('/groups', form);
      resetForm();
      setStatus({ type: 'success', text: 'Group created successfully.' });
      closeCreateModal();
      onRefresh?.();
    } catch (err) {
      setStatus({
        type: 'error',
        text: err.response?.data?.error || 'Unable to create group',
      });
    }
  };

  return (
    <section className='admin-section'>
      <div className='split'>
        <h2>Groups</h2>
        <button type='button' className='btn' onClick={openCreateModal}>
          Create Group
        </button>
      </div>

      {status.text && !showCreateModal && (
        <div className={`alert ${status.type === 'error' ? 'error' : 'success'}`}>
          {status.text}
        </div>
      )}

      <section>
        <div className='split mb-1'>
          <h3>Created Groups</h3>
        </div>

        {groups.length > 0 ? (
          <div className='classroom-grid' style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {groups.map((group) => (
              <Link
                key={group._id}
                to={`/groups/${group._id}`}
                style={{ display: 'flex', flexDirection: 'column', borderRadius: '12px', border: '1px solid #e5e7eb', backgroundColor: '#fff', textDecoration: 'none', color: 'inherit', overflow: 'hidden', transition: 'transform 0.2s, box-shadow 0.2s', padding: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{ backgroundColor: '#e5e7eb', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Code: {group.joinCode}
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h6v6H4z"></path><path d="M14 4h6v6h-6z"></path><path d="M14 14h6v6h-6z"></path><path d="M4 14h6v6H4z"></path></svg>
                  </span>
                  <span style={{ backgroundColor: '#4f46e5', color: '#fff', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Created by you
                  </span>
                </div>

                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1 }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', color: '#111827' }}>{group.name}</h3>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                      {group.memberCount || 0} Members
                    </div>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#374151', minHeight: '1.5rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {group.description || 'No description provided'}
                  </p>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ backgroundColor: '#f3f4f6', color: '#374151', padding: '4px 10px', borderRadius: '10px', fontSize: '0.85rem' }}>Max {group.maxMembers || 200} members</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className='card classroom-empty-state'>
            <p className='muted'>No groups created yet.</p>
          </div>
        )}
      </section>

      {showCreateModal && (
        <div className='admin-modal-backdrop' onClick={closeCreateModal}>
          <div className='card admin-modal-card' onClick={(e) => e.stopPropagation()}>
            <div className='split'>
              <h3>Create Group</h3>
              <button
                type='button'
                className='btn secondary'
                onClick={closeCreateModal}
              >
                Close
              </button>
            </div>

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
              <div>
                <label>Join Code</label>
                <input
                  required
                  minLength='6'
                  maxLength='12'
                  value={form.joinCode}
                  placeholder='DBMS2026'
                  onChange={(e) => setForm((prev) => ({ ...prev, joinCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                />
                <small className='muted'>Use 6-12 uppercase letters or numbers.</small>
              </div>
              <div>
                <label>Max Members</label>
                <input
                  type='number'
                  min='1'
                  max='5000'
                  value={form.maxMembers}
                  onChange={(e) => setForm((prev) => ({ ...prev, maxMembers: e.target.value }))}
                />
              </div>

              {status.text && (
                <div className={`alert ${status.type === 'error' ? 'error' : 'success'}`}>
                  {status.text}
                </div>
              )}

              <div className='admin-modal-actions'>
                <button type='button' className='btn secondary' onClick={closeCreateModal}>
                  Cancel
                </button>
                <button type='submit' className='btn'>Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
