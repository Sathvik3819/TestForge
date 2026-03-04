import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function NavBar() {
  const { user, logout } = useContext(AuthContext);

  return (
    <header className='nav-wrap'>
      <nav className='navbar'>
        <Link to='/' className='brand'>
          TestForge
        </Link>

        <div className='nav-links'>
          {user ? (
            <>
              <Link to='/dashboard' className='nav-link'>
                Dashboard
              </Link>
              <Link to='/exams' className='nav-link'>
                Exams
              </Link>
              {user.role === 'admin' && (
                <Link to='/create-exam' className='nav-link'>
                  Create Exam
                </Link>
              )}
              <button onClick={logout} className='nav-action'>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to='/login' className='nav-link'>
                Login
              </Link>
              <Link to='/signup' className='nav-link cta'>
                Create Account
              </Link>
            </>
          )}
        </div>
      </nav>

      <div className='nav-sub'>
        <div className='nav-sub-inner'>
          <span>Live Assessments</span>
          <span>Practice Papers</span>
          <span>Create Exam</span>
          <span>Security Signals</span>
          <span>Support</span>
        </div>
      </div>
    </header>
  );
}
