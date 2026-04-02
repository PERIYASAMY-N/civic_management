import { Link } from 'react-router-dom';
import { ShieldCheck, MapPin, BarChart3, Users } from 'lucide-react';

const Home = () => {
  return (
    <div className="home-container">
      <nav className="glass">
        <div className="nav-content">
          <h1>Civic<span>Hub</span></h1>
          <div className="nav-links">
            <Link to="/login" className="btn">Login</Link>
            <Link to="/register" className="btn btn-primary">Join Now</Link>
          </div>
        </div>
      </nav>

      <main>
        <div className="hero-section">
          <h2>Report. Track. <span>Resolve.</span></h2>
          <p>The ultimate transparency platform bridging the gap between citizens and authorities.</p>
          <div className="hero-btns">
            <Link to="/register" className="btn btn-primary">Report an Issue</Link>
            <Link to="/dashboard" className="btn">View Transparency Feed</Link>
          </div>
        </div>

        <div className="features-grid">
          <div className="feature-card glass">
            <MapPin className="icon" />
            <h3>Location Aware</h3>
            <p>Precise mapping for every reported civic issue.</p>
          </div>
          <div className="feature-card glass">
            <ShieldCheck className="icon" />
            <h3>Verified Process</h3>
            <p>Full proof of work with before/after documentation.</p>
          </div>
          <div className="feature-card glass">
            <BarChart3 className="icon" />
            <h3>Total Transparency</h3>
            <p>Real-time analytics and public status tracking.</p>
          </div>
          <div className="feature-card glass">
            <Users className="icon" />
            <h3>Community Powered</h3>
            <p>Volunteers and workers collaborating for a better city.</p>
          </div>
        </div>
      </main>

      <style>{`
        .home-container {
          min-height: 100vh;
          background: var(--bg-main);
        }
        nav {
          position: sticky;
          top: 0;
          z-index: 100;
          padding: 1rem 2rem;
        }
        .nav-content {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        h1 span { color: var(--primary); }
        .hero-section {
          max-width: 800px;
          margin: 4rem auto;
          text-align: center;
          padding: 0 2rem;
        }
        .hero-section h2 {
          font-size: 4rem;
          margin-bottom: 1.5rem;
          line-height: 1.1;
        }
        .hero-section h2 span { color: var(--primary); }
        .hero-section p {
          font-size: 1.25rem;
          color: var(--text-muted);
          margin-bottom: 3rem;
        }
        .hero-btns {
          display: flex;
          justify-content: center;
          gap: 1.5rem;
        }
        .features-grid {
          max-width: 1200px;
          margin: 6rem auto;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 2rem;
          padding: 0 2rem;
        }
        .feature-card {
          padding: 2.5rem;
          border-radius: 20px;
          text-align: center;
          transition: transform 0.3s ease;
        }
        .feature-card:hover {
          transform: translateY(-10px);
        }
        .feature-card h3 { margin: 1.5rem 0 1rem; }
        .feature-card p { color: var(--text-muted); }
        .icon {
          width: 48px;
          height: 48px;
          color: var(--primary);
          margin: 0 auto;
        }
      `}</style>
    </div>
  );
};

export default Home;
