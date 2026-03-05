import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const loggedInUser = await login(email, password);
      navigate(loggedInUser?.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.response?.data?.msg || 'Login failed');
    }
  };

  return (
    <div className='auth-wrap'>
      <div className='card auth-card'>
        <h2 className='section-title'>Welcome back</h2>
        <p className='section-subtitle'>Log in to continue your assessment workflow.</p>

        {error && <div className='alert error'>{error}</div>}

        <form className='auth-form' onSubmit={handleSubmit}>
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
              placeholder='Enter your password'
              required
            />
          </div>

          <button type='submit' className='btn auth-submit'>Sign In</button>
        </form>

        <p className='auth-footnote'>
          New here?{' '}
          <Link to='/signup' className='auth-link'>
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
