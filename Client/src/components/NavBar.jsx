import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContextValue';
import { preloadRoute } from '../lazyPages';

export default function NavBar() {
  const { user, logout } = useContext(AuthContext);
  const withPreload = (path) => ({
    onMouseEnter: () => preloadRoute(path),
    onFocus: () => preloadRoute(path),
  });

  return (
    <header className='nav-wrap shadow'>
      <nav className='navbar'>
        <Link to={user ? '/dashboard' : '/'} className='brand' {...withPreload(user ? '/dashboard' : '/')}>
          TestForge
        </Link>

        <div className='nav-links'>
          {user ? (
            <>
              <Link to='/dashboard' className='nav-link' {...withPreload('/dashboard')}>
                Student Panel
              </Link>
              <Link to='/admin' className='nav-link' {...withPreload('/admin')}>
                Admin Panel
              </Link>
              <Link to='/profile' className='nav-link' {...withPreload('/profile')}>
                Profile
              </Link>
              <button onClick={logout} className='nav-action'>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to='/login' className='nav-link' {...withPreload('/login')}>
                Login
              </Link>
              <Link to='/signup' className='nav-link cta' {...withPreload('/signup')}>
                Create Account
              </Link>
            </>
          )}
        </div>
      </nav>

    </header>
  );
}
