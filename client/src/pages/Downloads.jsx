import { Download, FileText, CheckCircle, FileOutput } from 'lucide-react';

const Downloads = () => {
  const downloadItems = [
    {
      title: 'Complaint Receipt',
      description: 'Download the official receipt for your submitted complaints.',
      icon: FileText,
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.1)',
      onClick: () => {
        alert('This feature will be available once the PDF generation backend is active.');
      }
    },
    {
      title: 'Complaint History',
      description: 'Download a complete history of all your reported issues.',
      icon: FileOutput,
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.1)',
      onClick: () => {
        alert('This feature will be available once the PDF generation backend is active.');
      }
    },
    {
      title: 'Completion Certificate',
      description: 'Download the completion certificate for resolved complaints.',
      icon: CheckCircle,
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.1)',
      onClick: () => {
        alert('This feature will be available once the PDF generation backend is active.');
      }
    }
  ];

  return (
    <div className="fade-in" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Download className="text-primary" /> Document Downloads
        </h2>
        <p style={{ color: 'var(--text-muted)' }}>
          Access and download official documents related to your civic complaints.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        {downloadItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <div key={index} className="glass" style={{ padding: '2rem', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '1rem', borderRadius: '50%', background: item.bg, width: 'max-content', marginBottom: '1.5rem' }}>
                <Icon size={32} color={item.color} />
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{item.title}</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', flex: 1 }}>{item.description}</p>
              
              <button 
                onClick={item.onClick}
                className="btn btn-primary" 
                style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
              >
                <Download size={18} /> Download PDF
              </button>
            </div>
          )
        })}
      </div>
    </div>
  );
};

export default Downloads;
