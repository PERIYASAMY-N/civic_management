import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, MapPin, BarChart3, Users, Building, AlertTriangle, ArrowRight } from 'lucide-react';
import './Landing.css';

const Landing = () => {
  return (
    <div className="landing-container">
      {/* Navigation */}
      <nav className="glass nav-header">
        <div className="nav-content">
          <div className="logo">
            <Building className="logo-icon" />
            <h1>Civic<span>Hub</span></h1>
          </div>
          <div className="nav-links">
            <Link to="/public/dashboard" className="btn btn-ghost">Dashboard</Link>
            <Link to="/login" className="btn btn-outline">Login</Link>
            <Link to="/register" className="btn btn-primary">Join Now</Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main>
        <section className="hero-section">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="hero-content"
          >
            <div className="badge">
              <span className="live-dot"></span> Live in 12+ Smart Cities
            </div>
            <h2>
              The OS for <br />
              <span className="gradient-text">Modern Communities</span>
            </h2>
            <p className="hero-subtitle">
              Report issues, track progress, and collaborate with authorities in real-time. 
              Bridging the gap between citizens and local government for a better tomorrow.
            </p>
            <div className="hero-btns">
              <Link to="/report" className="btn btn-primary btn-large">
                <AlertTriangle size={20} />
                Report an Issue
              </Link>
              <Link to="/public/dashboard" className="btn btn-secondary btn-large">
                Track Issues <ArrowRight size={20} />
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Stats Section */}
        <section className="stats-section glass">
          <div className="stat-card">
            <h3>24k+</h3>
            <p>Issues Resolved</p>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-card">
            <h3>150+</h3>
            <p>Active Departments</p>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-card">
            <h3>45m</h3>
            <p>Avg. Response Time</p>
          </div>
          <div className="stat-divider"></div>
          <div className="stat-card">
            <h3>98%</h3>
            <p>Citizen Satisfaction</p>
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section">
          <div className="section-header">
            <h2>Powered by Transparency</h2>
            <p>Everything you need to build a smarter, safer, and cleaner city together.</p>
          </div>
          
          <div className="features-grid">
            <motion.div whileHover={{ y: -10 }} className="feature-card glass">
              <div className="icon-wrapper"><MapPin className="feature-icon" /></div>
              <h3>Geospatial Tracking</h3>
              <p>Every report is tied to exact coordinates, ensuring authorities know exactly where to dispatch workers.</p>
            </motion.div>
            
            <motion.div whileHover={{ y: -10 }} className="feature-card glass">
              <div className="icon-wrapper"><ShieldCheck className="feature-icon" /></div>
              <h3>Verified Workflow</h3>
              <p>Mandatory before and after documentation ensures work is completed to city standards before closure.</p>
            </motion.div>
            
            <motion.div whileHover={{ y: -10 }} className="feature-card glass">
              <div className="icon-wrapper"><BarChart3 className="feature-icon" /></div>
              <h3>Public Analytics</h3>
              <p>Hold departments accountable with real-time performance dashboards accessible to every citizen.</p>
            </motion.div>
            
            <motion.div whileHover={{ y: -10 }} className="feature-card glass">
              <div className="icon-wrapper"><Users className="feature-icon" /></div>
              <h3>Community Collaboration</h3>
              <p>Special portals for civic volunteers and registered NGOs to claim non-hazardous community tasks.</p>
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Landing;
