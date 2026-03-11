import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function NavBar() {
  const { user, logout } = useContext(AuthContext);

  return (
    <header className='nav-wrap shadow'>
      <nav className='navbar'>
        <Link to='/dashboard' className='brand'>
          TestForge
        </Link>

        <div className='nav-links'>
          {user ? (
            <>
              <Link to='/dashboard' className='nav-link'>
                Student Panel
              </Link>
              <Link to='/admin' className='nav-link'>
                Admin Panel
              </Link>
              <Link to='/profile' className='nav-link'>
                Profile
              </Link>
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

    </header>
  );
}
