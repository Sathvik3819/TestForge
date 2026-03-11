import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import API from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import { AuthContext } from '../context/AuthContextValue';

export default function JoinGroup() {
    const { token } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useContext(AuthContext);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [inviteData, setInviteData] = useState(null);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        // If not logged in, redirect to login page, but remember where we are trying to go
        if (!user) {
            navigate('/login', { state: { from: location.pathname } });
            return;
        }

        const checkInvite = async () => {
            try {
                const res = await API.get(`/groups/invite/${token}`);
                setInviteData(res.data.invite);
            } catch (err) {
                setError(err.response?.data?.error || 'Invalid or expired invite link.');
            } finally {
                setLoading(false);
            }
        };

        checkInvite();
    }, [token, user, navigate, location.pathname]);

    const handleJoin = async () => {
        try {
            setJoining(true);
            setError('');
            const res = await API.post(`/groups/invite/${token}/use`);
            // Redirect to the newly joined group
            navigate(`/groups/${res.data.group._id}`);
        } catch (err) {
            setError(err.response?.data?.error || 'Unable to join group.');
            setJoining(false);
        }
    };

    if (!user) return null; // Let the useEffect redirect handle this smoothly

    return (
        <div className='container' style={{ maxWidth: '600px', margin: '4rem auto' }}>
            <div className='card' style={{ textAlign: 'center', padding: '2rem' }}>
                {loading ? (
                    <LoadingSpinner label='Checking invite link...' minHeight='180px' />
                ) : error ? (
                    <>
                        <h2 style={{ marginBottom: '1rem', color: '#dc2626' }}>Invite Invalid</h2>
                        <p className='muted' style={{ marginBottom: '2rem' }}>{error}</p>
                        <button className='btn secondary' onClick={() => navigate('/dashboard')}>
                            Return to Dashboard
                        </button>
                    </>
                ) : (
                    <>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#43b5a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 1.5rem auto' }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                        <h2 style={{ marginBottom: '1rem' }}>You've been invited!</h2>
                        <p style={{ marginBottom: '0.5rem', color: '#374151' }}>
                            You're invited to join the class:
                        </p>
                        <div style={{ padding: '1.5rem', backgroundColor: '#f3f4f6', borderRadius: '8px', marginBottom: '2rem' }}>
                            <h3 style={{ margin: '0 0 0.5rem 0', color: '#111827' }}>{inviteData?.groupId?.name}</h3>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>
                                {inviteData?.groupId?.description || 'No description provided.'}
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button
                                className='btn secondary'
                                onClick={() => navigate('/dashboard')}
                                disabled={joining}
                            >
                                Cancel
                            </button>
                            <button
                                className='btn'
                                onClick={handleJoin}
                                disabled={joining}
                            >
                                {joining ? (
                                    <LoadingSpinner inline size='sm' className='loading-spinner--button' label='Joining...' />
                                ) : 'Join Classroom'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
