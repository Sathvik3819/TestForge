import { useState, useContext, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import Sidebar from '../components/Sidebar';
import { AuthContext } from '../context/AuthContextValue';
import API from '../api';

export default function Profile() {
    const { user, setUser } = useContext(AuthContext);

    const [selectedTab, setSelectedTab] = useState('overview');
    const [editing, setEditing] = useState(false);

    const [profileData, setProfileData] = useState({
        name: '',
        email: '',
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [passLoading, setPassLoading] = useState(false);
    const [passMessage, setPassMessage] = useState(null);
    const [passError, setPassError] = useState(null);

    useEffect(() => {
        if (user) {
            setProfileData({ name: user.name || '', email: user.email || '' });
        }
    }, [user]);

    const handleProfileChange = (e) => {
        const { name, value } = e.target;
        setProfileData((prev) => ({ ...prev, [name]: value }));
    };

    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswordData((prev) => ({ ...prev, [name]: value }));
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setMessage(null);

        try {
            setLoading(true);
            const res = await API.put('/auth/profile', {
                name: profileData.name,
                email: profileData.email,
            });
            const updatedUser = { ...user, ...res.data.user };
            localStorage.setItem('user', JSON.stringify(res.data.user));
            setUser(updatedUser);
            setMessage('Profile updated successfully!');
            setEditing(false);
        } catch (err) {
            setError(err.response?.data?.msg || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setPassError(null);
        setPassMessage(null);

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setPassError('New passwords do not match');
            return;
        }
        if (passwordData.newPassword.length < 6) {
            setPassError('Password must be at least 6 characters');
            return;
        }

        try {
            setPassLoading(true);
            const res = await API.put('/auth/profile', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword,
            });
            setPassMessage('Password updated successfully');
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            // update user info in case backend returned a modified version
            if (res.data?.user) {
                const updatedUser = { ...user, ...res.data.user };
                localStorage.setItem('user', JSON.stringify(res.data.user));
                setUser(updatedUser);
            }
        } catch (err) {
            setPassError(err.response?.data?.msg || 'Failed to update password');
        } finally {
            setPassLoading(false);
        }
    };

    if (!user) {
        return (
            <div className='auth-wrap'>
                <div className='card'>
                    <LoadingSpinner label='Loading profile...' minHeight='180px' />
                </div>
            </div>
        );
    }

    const sidebarItems = [
        { label: 'Profile Overview', onClick: () => setSelectedTab('overview'), active: selectedTab === 'overview' },
        { label: 'Security', onClick: () => setSelectedTab('security'), active: selectedTab === 'security' },
    ];

    const joinedLabel = user.createdAt
        ? new Date(user.createdAt).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        })
        : 'Not available';

    const initials = user.name
        ? user.name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join('')
        : '?';

    const roleLabel = user.role === 'admin' ? 'Administrator' : 'Student';
    const memberSince = user.createdAt
        ? new Date(user.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
        })
        : 'New member';

    return (
        <div className='dashboard-layout'>
            <Sidebar title='Account' items={sidebarItems} />
            <section className='dashboard-main profile-main'>
                {selectedTab === 'overview' && (
                    <div className='profile-shell'>
                        <div className='profile-header card'>
                            <div className='profile-header-main'>
                                <span className='profile-eyebrow'>Account Settings</span>
                                <h1>Profile</h1>
                                <p>
                                    Update your personal details and keep your account information
                                    consistent across exams, results, and notifications.
                                </p>
                            </div>
                            <div className='profile-header-actions'>
                                <button className='btn ' onClick={() => setSelectedTab('security')}>
                                    Security
                                </button>
                                <button className='btn' onClick={() => setEditing((prev) => !prev)}>
                                    {editing ? 'Close Editor' : 'Edit Profile'}
                                </button>
                            </div>
                        </div>

                        <div className='profile-grid'>
                            <div className='identity-card card profile-panel profile-summary-panel'>
                                <div className='profile-panel-head'>
                                    <h2>Account Summary</h2>
                                    <div className='profile-summary-actions'>
                                        <span className='profile-chip'>{roleLabel}</span>
                                        <button
                                            type='button'
                                            className='btn  profile-inline-edit'
                                            onClick={() => setEditing((prev) => !prev)}
                                        >
                                            {editing ? 'Close Edit' : 'Edit'}
                                        </button>
                                    </div>
                                </div>

                                <div className='profile-identity'>
                                    <div className='avatar profile-avatar'>{initials}</div>
                                    <div className='profile-summary-text profile-summary-text-dark'>
                                        <strong>{user.name}</strong>
                                        <span>{user.email}</span>
                                        <span>Member since {memberSince}</span>
                                    </div>
                                </div>

                                {error && <div className='alert error'>{error}</div>}
                                {message && <div className='alert success'>{message}</div>}

                                <form onSubmit={handleProfileSubmit} className='profile-table-wrap'>
                                    <div className='profile-table'>
                                        <div className='profile-row profile-row-head'>
                                            <span>Field</span>
                                            <span>Value</span>
                                            <span>Edit</span>
                                        </div>

                                        <div className='profile-row'>
                                            <span className='profile-field-label'>Full Name</span>
                                            {editing ? (
                                                <input
                                                    id='name'
                                                    name='name'
                                                    value={profileData.name}
                                                    onChange={handleProfileChange}
                                                    required
                                                />
                                            ) : (
                                                <strong>{user.name}</strong>
                                            )}
                                            <button
                                                type='button'
                                                className='profile-row-action'
                                                onClick={() => setEditing(true)}
                                            >
                                                Edit
                                            </button>
                                        </div>

                                        <div className='profile-row'>
                                            <span className='profile-field-label'>Email Address</span>
                                            {editing ? (
                                                <input
                                                    id='email'
                                                    type='email'
                                                    name='email'
                                                    value={profileData.email}
                                                    onChange={handleProfileChange}
                                                    required
                                                />
                                            ) : (
                                                <strong>{user.email}</strong>
                                            )}
                                            <button
                                                type='button'
                                                className='profile-row-action'
                                                onClick={() => setEditing(true)}
                                            >
                                                Edit
                                            </button>
                                        </div>

                                        <div className='profile-row'>
                                            <span className='profile-field-label'>Account Type</span>
                                            <strong>{roleLabel}</strong>
                                            <span className='profile-row-static'>Locked</span>
                                        </div>

                                        <div className='profile-row'>
                                            <span className='profile-field-label'>Joined</span>
                                            <strong>{joinedLabel}</strong>
                                            <span className='profile-row-static'>Read only</span>
                                        </div>

                                        <div className='profile-row'>
                                            <span className='profile-field-label'>Account Status</span>
                                            <strong>Active</strong>
                                            <span className='profile-row-static'>System</span>
                                        </div>
                                    </div>

                                    <div className='profile-note'>
                                        Keep your profile details accurate so exam records and
                                        notifications stay in sync.
                                    </div>

                                    {editing && (
                                        <div className='action-row'>
                                            <button
                                                type='button'
                                                className='btn btn-secondary'
                                                onClick={() => {
                                                    setEditing(false);
                                                    setProfileData({
                                                        name: user.name || '',
                                                        email: user.email || '',
                                                    });
                                                }}
                                            >
                                                Cancel
                                            </button>
                                            <button type='submit' className='btn' disabled={loading}>
                                                {loading ? (
                                                    <LoadingSpinner inline size='sm' className='loading-spinner--button' label='Saving...' />
                                                ) : 'Save Changes'}
                                            </button>
                                        </div>
                                    )}
                                </form>
                            </div>
                        </div>
                    </div>
                )}
                {selectedTab === 'security' && (
                    <div className='security-shell'>
                        <div className='card security-card security-hero'>
                            <div className='profile-header-main'>
                                <span className='profile-eyebrow'>Security Settings</span>
                                <h2>Protect your account access</h2>
                                <p className='muted'>
                                    Change your password regularly and avoid reusing credentials
                                    from other platforms.
                                </p>
                            </div>
                            <div className='security-badges'>
                                <span className='security-badge'>Current session active</span>
                                <span className='security-badge'>Minimum 6 characters</span>
                            </div>
                        </div>

                        <div className='card security-card'>
                            <div className='profile-panel-head'>
                                <h3>Change Password</h3>
                                <span className='profile-chip muted-chip'>Manual update</span>
                            </div>
                            {passError && <div className='alert error'>{passError}</div>}
                            {passMessage && <div className='alert success'>{passMessage}</div>}
                            <form onSubmit={handlePasswordSubmit} className='auth-form profile-form'>
                                <div>
                                    <label htmlFor='currentPassword'>Current Password</label>
                                    <input
                                        id='currentPassword'
                                        type='password'
                                        name='currentPassword'
                                        value={passwordData.currentPassword}
                                        onChange={handlePasswordChange}
                                        required
                                    />
                                </div>
                                <div className='profile-form-grid'>
                                    <div>
                                        <label htmlFor='newPassword'>New Password</label>
                                        <input
                                            id='newPassword'
                                            type='password'
                                            name='newPassword'
                                            value={passwordData.newPassword}
                                            onChange={handlePasswordChange}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor='confirmPassword'>Confirm Password</label>
                                        <input
                                            id='confirmPassword'
                                            type='password'
                                            name='confirmPassword'
                                            value={passwordData.confirmPassword}
                                            onChange={handlePasswordChange}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className='profile-note'>
                                    Choose a password that is easy for you to remember and hard for
                                    others to guess.
                                </div>
                                <button type='submit' className='btn' disabled={passLoading}>
                                    {passLoading ? (
                                        <LoadingSpinner inline size='sm' className='loading-spinner--button' label='Updating...' />
                                    ) : 'Update Password'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </section>
        </div>
    )

}
