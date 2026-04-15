import { forwardRef } from 'react';
import CornerOrnament from './CornerOrnament';
import SealIcon from './SealIcon';

const CertificateTemplate = forwardRef(({ recipientName, courseName, date, organizationName }, ref) => {
  const displayName = recipientName || 'Julian Vane';
  const displayCourse = courseName || 'Mastery of Digital Craftsmanship';
  const displayOrg = organizationName || 'The Sovereign Atelier';
  const displayDate = date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

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

      {/* Outer gold border */}
      <div style={{
        position: 'absolute',
        inset: '16px',
        border: '3px solid #D4AF37',
        borderRadius: '3px',
        pointerEvents: 'none',
      }} />
      {/* Inner gold border */}
      <div style={{
        position: 'absolute',
        inset: '28px',
        border: '1px solid rgba(212,175,55,0.5)',
        borderRadius: '2px',
        pointerEvents: 'none',
      }} />

      {/* Corner ornaments */}
      <div style={{ position: 'absolute', top: '12px', left: '12px' }}>
        <CornerOrnament />
      </div>
      <div style={{ position: 'absolute', top: '12px', right: '12px', transform: 'scaleX(-1)' }}>
        <CornerOrnament />
      </div>
      <div style={{ position: 'absolute', bottom: '12px', left: '12px', transform: 'scaleY(-1)' }}>
        <CornerOrnament />
      </div>
      <div style={{ position: 'absolute', bottom: '12px', right: '12px', transform: 'scale(-1)' }}>
        <CornerOrnament />
      </div>

      {/* Content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        height: '100%',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Organization name */}
        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '14px',
          fontWeight: '600',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color: '#7c4dff',
          margin: '20px 0 24px 0',
        }}>
          {displayOrg}
        </p>

        {/* Title */}
        <h1 style={{
          fontFamily: '"Noto Serif", Georgia, serif',
          fontSize: '56px',
          fontWeight: '700',
          color: '#1a1a1a',
          letterSpacing: '-0.01em',
          margin: '0 0 8px 0',
          lineHeight: '1.1',
        }}>
          Certificate
        </h1>
        <h2 style={{
          fontFamily: '"Noto Serif", Georgia, serif',
          fontSize: '24px',
          fontWeight: '400',
          color: '#4a4a4a',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          margin: '0 0 32px 0',
        }}>
          of Achievement
        </h2>

        {/* Gold divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
          <div style={{ width: '80px', height: '1px', background: 'linear-gradient(to right, transparent, #D4AF37)' }} />
          <svg width="16" height="16" viewBox="0 0 12 12"><polygon points="6,0 7.5,4.5 12,4.5 8.5,7 10,11.5 6,9 2,11.5 3.5,7 0,4.5 4.5,4.5" fill="#D4AF37" /></svg>
          <div style={{ width: '80px', height: '1px', background: 'linear-gradient(to right, #D4AF37, transparent)' }} />
        </div>

        {/* Certify text */}
        <p style={{
          fontFamily: '"Noto Serif", Georgia, serif',
          fontSize: '20px',
          fontStyle: 'italic',
          color: '#666',
          margin: '0 0 16px 0',
          letterSpacing: '0.02em',
        }}>
          This is to proudly certify that
        </p>

        {/* Recipient name */}
        <div style={{ marginBottom: '24px', position: 'relative' }}>
          <h2 style={{
            fontFamily: '"Noto Serif", Georgia, serif',
            fontSize: '54px',
            fontWeight: '700',
            color: '#C49A00',
            margin: '0',
            letterSpacing: '-0.01em',
            lineHeight: '1.1',
            padding: '0 40px',
          }}>
            {displayName}
          </h2>
          {/* Underline decoration */}
          <div style={{
            height: '2px',
            background: 'linear-gradient(to right, transparent, #D4AF37 30%, #D4AF37 70%, transparent)',
            marginTop: '8px',
          }} />
        </div>

        {/* Achievement text */}
        <p style={{
          fontFamily: '"Noto Serif", Georgia, serif',
          fontSize: '18px',
          color: '#555',
          margin: '0 0 8px 0',
          fontStyle: 'italic',
        }}>
          has successfully completed
        </p>
        <p style={{
          fontFamily: '"Noto Serif", Georgia, serif',
          fontSize: '24px',
          fontWeight: '600',
          color: '#2a1a6a',
          margin: '0 0 32px 0',
          letterSpacing: '0.01em',
        }}>
          {displayCourse}
        </p>

        {/* Seal */}
        <div style={{ marginBottom: '30px' }}>
          <SealIcon />
        </div>

        {/* Bottom info row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          width: '100%',
          marginTop: 'auto',
          paddingTop: '20px',
        }}>
          {/* Date column */}
          <div style={{ textAlign: 'left', width: '250px' }}>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '12px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#888',
              margin: '0 0 8px 0',
            }}>Date Issued</p>
            <p style={{
              fontFamily: '"Noto Serif"',
              fontSize: '18px',
              color: '#333',
              margin: '0',
              borderTop: '1px solid #ccc',
              paddingTop: '8px'
            }}>{displayDate}</p>
          </div>

          {/* Signature column */}
          <div style={{ textAlign: 'center', width: '250px' }}>
            <div style={{
              width: '100%',
              borderBottom: '1px solid #555',
              marginBottom: '8px',
              height: '40px',
            }}>
                {/* Signature could go here */}
            </div>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '12px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#888',
              margin: '0',
            }}>Authorized Signature</p>
          </div>

          {/* Certificate ID */}
          <div style={{ textAlign: 'right', width: '250px' }}>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '12px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: '#888',
              margin: '0 0 8px 0',
            }}>Certificate ID</p>
            <p style={{
              fontFamily: 'monospace',
              fontSize: '16px',
              color: '#7c4dff',
              margin: '0',
              borderTop: '1px solid #ccc',
              paddingTop: '8px'
            }}>
              {`CERT-${Math.random().toString(36).substr(2, 8).toUpperCase()}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

CertificateTemplate.displayName = 'CertificateTemplate';
export default CertificateTemplate;
