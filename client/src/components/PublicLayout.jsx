import { Outlet } from 'react-router-dom';

const PublicLayout = ({ children }) => {
  return (
    <div className="public-layout-container">
      {children || <Outlet />}
    </div>
  );
};

export default PublicLayout;
