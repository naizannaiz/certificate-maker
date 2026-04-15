import { useRef, useState, useEffect } from 'react';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import CertificateTemplate from './CertificateTemplate';

const CertificatePreview = ({ certData, isGenerated }) => {
  // visibleRef — the scaled-down version shown in the UI
  const visibleRef = useRef(null);
  // hiddenRef — a hidden full-size version used exclusively for PDF capture
  const hiddenRef = useRef(null);
  const containerRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const available = containerRef.current.offsetWidth;
        setScale(Math.min(1, available / 1123));
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const handleDownloadPDF = async () => {
    if (!hiddenRef.current || !isGenerated) return;
    setIsDownloading(true);

    try {
      // Capture the hidden full-resolution version — no transforms, no scaling
      const dataUrl = await toJpeg(hiddenRef.current, {
        quality: 0.98,
        pixelRatio: 3,
        backgroundColor: '#fffef8',
        width: 1123,
        height: 794,
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);

      const safeName = (certData?.fullName || 'certificate').replace(/\s+/g, '_');
      pdf.save(`${safeName}_Certificate.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const certProps = {
    recipientName: certData?.fullName,
    courseName: certData?.courseName,
    organizationName: certData?.organizationName,
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  };

  return (
    <div className="w-full flex flex-col items-center" ref={containerRef}>

      {/* ── Visible scaled preview ── */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{ width: '100%', height: `${794 * scale}px` }}
      >
        {!isGenerated ? (
          /* Empty state — placeholder same dimensions */
          <div
            className="flex flex-col items-center justify-center px-4"
            style={{
              width: `${1123 * scale}px`,
              height: `${794 * scale}px`,
              background: '#fffef8',
              border: '3px solid rgba(212,175,55,0.35)',
              borderRadius: '6px',
            }}
          >
            <span
              className="material-symbols-outlined mb-3 sm:mb-4 text-[#e9c349]"
              style={{ fontSize: `${Math.max(48, 72 * scale)}px`, opacity: 0.5, fontVariationSettings: "'FILL' 1" }}
            >
              workspace_premium
            </span>
            <h3 className="font-headline text-on-surface/70" style={{ fontSize: `${Math.max(14, 24 * scale)}px`, marginBottom: '6px' }}>Live Preview</h3>
            <p className="font-body text-[#353341] text-center" style={{ fontSize: `${Math.max(11, 16 * scale)}px`, maxWidth: `${280 * scale}px` }}>
              Complete the form above to preview your certificate.
            </p>
          </div>
        ) : (
          /* Scale-transformed live preview */
          <div
            ref={visibleRef}
            style={{
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
              width: '1123px',
              height: '794px',
              position: 'absolute',
              top: 0,
              left: 0,
              pointerEvents: 'none',
            }}
          >
            <CertificateTemplate {...certProps} />
          </div>
        )}
      </div>

      {/* ── Hidden full-size element for PDF capture ── */}
      {/* Positioned off-screen so it doesn't affect layout but IS in the DOM */}
      {isGenerated && (
        <div
          style={{
            position: 'fixed',
            top: '-9999px',
            left: '-9999px',
            width: '1123px',
            height: '794px',
            zIndex: -1,
            pointerEvents: 'none',
          }}
        >
          <CertificateTemplate ref={hiddenRef} {...certProps} />
        </div>
      )}

      {/* ── Download button ── */}
      {isGenerated && (
        <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row gap-3 relative z-20 w-full sm:w-auto">
          <button
            onClick={handleDownloadPDF}
            disabled={isDownloading}
            className="w-full sm:w-auto bg-secondary/10 border border-secondary text-secondary px-6 sm:px-8 py-3.5 rounded-lg font-label uppercase tracking-widest text-xs font-bold flex items-center justify-center space-x-3 hover:bg-secondary hover:text-on-secondary transition-all disabled:opacity-60"
          >
            <span
              className={`material-symbols-outlined text-lg ${isDownloading ? 'animate-spin' : ''}`}
            >
              {isDownloading ? 'sync' : 'download'}
            </span>
            <span>{isDownloading ? 'Generating…' : 'Download PDF'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CertificatePreview;
