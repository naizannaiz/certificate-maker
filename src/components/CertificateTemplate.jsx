import { forwardRef } from 'react';
import CornerOrnament from './CornerOrnament';
import SealIcon from './SealIcon';

const CertificateTemplate = forwardRef(({ certData }, ref) => {
  // Fallback to old hardcoded template if no dynamic data is provided (for safety/backward compatibility)
  if (!certData || !certData.template) {
    return (
      <div
        ref={ref}
        id="certificate-template"
        style={{
          width: '1123px', // A4 landscape width
          height: '794px', // A4 landscape height
          background: 'linear-gradient(160deg, #fffef8 0%, #fdf8ee 100%)',
          position: 'relative',
          padding: '50px 60px',
          boxSizing: 'border-box',
          fontFamily: '"Noto Serif", Georgia, serif',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
          <h1 style={{ fontSize: '56px', color: '#1a1a1a' }}>Certificate Maker</h1>
          <p>Please configure a template in the admin dashboard.</p>
        </div>
      </div>
    );
  }

  const { user, template } = certData;
  const config = template.config || { fields: [] };
  const bgUrl = template.background_url;

  // Render logic for field replacement.
  // E.g. "{{Name}}" -> user.name
  // "{{Certificate ID}}" -> user.certificate_id
  const renderFieldText = (fieldName) => {
    switch (fieldName) {
      case 'Name': return user?.name || 'Jane Doe';
      case 'Course': return user?.course || 'Mastery of Digital Craftsmanship';
      case 'Date': return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      case 'Certificate ID': return user?.certificate_id || 'CERT-XXXXXX';
      case 'Organization': return 'The Sovereign Atelier';
      default: return `[${fieldName}]`;
    }
  };

  return (
    <div
      ref={ref}
      id="certificate-template"
      style={{
        width: '1123px',
        height: '794px',
        position: 'relative',
        backgroundColor: '#ffffff',
        backgroundImage: bgUrl ? `url(${bgUrl})` : 'none',
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        overflow: 'hidden'
      }}
    >
      {/* If no background image, render the old ornaments to not look completely blank */}
      {!bgUrl && (
        <>
          <div style={{ position: 'absolute', inset: '16px', border: '3px solid #D4AF37', borderRadius: '3px', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '12px', left: '12px' }}><CornerOrnament /></div>
          <div style={{ position: 'absolute', top: '12px', right: '12px', transform: 'scaleX(-1)' }}><CornerOrnament /></div>
          <div style={{ position: 'absolute', bottom: '12px', left: '12px', transform: 'scaleY(-1)' }}><CornerOrnament /></div>
          <div style={{ position: 'absolute', bottom: '12px', right: '12px', transform: 'scale(-1)' }}><CornerOrnament /></div>
        </>
      )}

      {/* Render Dynamic Fields */}
      {config.fields.map(field => {
        // The builder uses an 800x566 canvas. The actual PDF is 1123x794.
        // We need to scale the coordinates and sizes up by the ratio.
        const scaleX = 1123 / 800;
        const scaleY = 794 / 566;

        return (
          <div
            key={field.id}
            style={{
              position: 'absolute',
              left: `${field.x * scaleX}px`,
              top: `${field.y * scaleY}px`,
              width: `${field.width * scaleX}px`,
              height: `${field.height * scaleY}px`,
              fontSize: `${field.fontSize * scaleX}px`,
              fontFamily: field.fontFamily,
              color: field.color,
              textAlign: field.textAlign,
              display: 'flex',
              alignItems: 'center',
              justifyContent: field.textAlign === 'center' ? 'center' : field.textAlign === 'right' ? 'flex-end' : field.textAlign === 'justify' ? 'space-between' : 'flex-start',
              lineHeight: 1,
              whiteSpace: 'nowrap'
            }}
          >
            {renderFieldText(field.name)}
          </div>
        );
      })}
    </div>
  );
});

CertificateTemplate.displayName = 'CertificateTemplate';
export default CertificateTemplate;
