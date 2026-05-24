import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getHomeRoute, getWakwakUser } from '../lib/wakwakUser';

/**
 * Redirige selon l'état de connexion :
 * - profil valide sur / → interface correspondante
 * - pas de profil sur route protégée → /
 */
export default function AuthGate({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthPage = location.pathname === '/';

  useEffect(() => {
    const user = getWakwakUser();

    if (isAuthPage) {
      if (user) {
        navigate(getHomeRoute(user.role), { replace: true });
      }
      return;
    }

    if (!user) {
      navigate('/', { replace: true });
    }
  }, [isAuthPage, location.pathname, navigate]);

  return children;
}
