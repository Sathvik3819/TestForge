import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const { signup } = useContext(AuthContext);
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signup({ name, email, password, role });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.msg || 'Signup failed');
    }
  };

  return (
    <div className='auth-wrap'>
      <div className='card auth-card fade-up'>
        <h2 className='section-title'>Create your account</h2>
        <p className='section-subtitle'>Set up your account and start using TestForge.</p>

        {error && <div className='alert error'>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor='name'>Full Name</label>
            <input
              id='name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Alex Johnson'
              required
            />
          </div>

          <div>
            <label htmlFor='email'>Email Address</label>
            <input
              id='email'
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='name@school.edu'
              required
            />
          </div>

          <div>
            <label htmlFor='password'>Password</label>
            <input
              id='password'
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder='Choose a strong password'
              required
            />
          </div>

          <div>
            <label htmlFor='role'>Role</label>
            <select id='role' value={role} onChange={(e) => setRole(e.target.value)}>
              <option value='student'>Student</option>
              <option value='admin'>Admin</option>
            </select>
          </div>

          <button type='submit'>Create Account</button>
        </form>

        <p className='muted'>
          Already registered?{' '}
          <Link to='/login' className='nav-link'>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
