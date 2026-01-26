import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Home page - Redirects to /feed (the primary authenticated landing page)
const Home = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the main feed page
    navigate('/feed', { replace: true });
  }, [navigate]);

  return (
    <div data-testid="home-page" className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-muted-foreground">Redirecting...</div>
    </div>
  );
};

export default Home;
