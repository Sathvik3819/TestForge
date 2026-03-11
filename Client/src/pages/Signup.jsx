import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signup } = useContext(AuthContext);
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await signup({ name, email, password });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.msg || 'Signup failed');
    }
  };

  return (
    <div className='auth-wrap'>
      <div className='card auth-card'>
        <h2 className='section-title'>Create your account</h2>
        <p className='section-subtitle'>Set up your account and start using TestForge.</p>

        {error && <div className='alert error'>{error}</div>}

        <form className='auth-form' onSubmit={handleSubmit}>
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

          <button type='submit' className='btn auth-submit'>Create Account</button>
        </form>

        <p className='auth-footnote'>
          Already registered?{' '}
          <Link to='/login' className='auth-link'>
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
