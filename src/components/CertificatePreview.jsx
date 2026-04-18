import { useState, useEffect } from 'react';
import { generateFilledPDF } from '../lib/pdfGenerator';
import { Loader2 } from 'lucide-react';

const CertificatePreview = ({ certData, isGenerated }) => {
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function generatePdf() {
      if (!isGenerated || !certData?.user || !certData?.template) return;
      
      try {
        setIsGenerating(true);
        const url = await generateFilledPDF(certData.user, certData.template);
        if (isMounted) {
          setPdfBlobUrl(url);
          setIsGenerating(false);
        }
      } catch (err) {
        console.error('Failed to generate PDF:', err);
        if (isMounted) {
          setError('Failed to generate your certificate. Please try again later.');
          setIsGenerating(false);
        }
      }
    }

    generatePdf();

    return () => {
      isMounted = false;
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [certData, isGenerated]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownloadPDF = () => {
    if (!pdfBlobUrl) return;
    const link = document.createElement('a');
    link.href = pdfBlobUrl;
    const safeName = (certData?.user?.name || 'certificate').replace(/\\s+/g, '_');
    link.download = `${safeName}_Certificate.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full flex flex-col items-center">
      {/* ── Preview Area ── */}
      <div className="w-full relative rounded-xl overflow-hidden border border-white/5 bg-surface-container-lowest min-h-[400px] flex items-center justify-center shadow-xl">
        {!isGenerated ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <span className="material-symbols-outlined mb-4 text-primary text-6xl opacity-50 font-variation-fill">
              workspace_premium
            </span>
            <h3 className="font-headline text-on-surface/70 text-xl mb-2">Live Preview</h3>
            <p className="font-body text-on-surface-variant max-w-sm">
              Complete the form above to preview and download your high-resolution certificate.
            </p>
          </div>
        ) : isGenerating ? (
          <div className="flex flex-col items-center text-primary p-12">
            <Loader2 size={48} className="animate-spin mb-4" />
            <p className="font-medium text-on-surface">Generating secure PDF...</p>
          </div>
        ) : error ? (
          <div className="text-red-400 p-6 bg-red-400/10 rounded-xl text-center m-8">
            <p>{error}</p>
          </div>
        ) : pdfBlobUrl ? (
          <iframe 
            src={`${pdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            className="w-full h-[600px] border-0"
            title="Certificate PDF Preview"
          />
        ) : null}
      </div>

      {/* ── Download button ── */}
      {isGenerated && (
        <div className="mt-6 flex flex-col sm:flex-row gap-3 relative z-20 w-full sm:w-auto">
          <button
            onClick={handleDownloadPDF}
            disabled={isGenerating || !pdfBlobUrl}
            className="w-full sm:w-auto bg-primary text-on-primary px-8 py-3.5 rounded-lg font-label uppercase tracking-widest text-xs font-bold flex items-center justify-center space-x-3 hover:bg-primary/90 transition-all disabled:opacity-60 shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined text-lg">
              download
            </span>
            <span>Download PDF</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CertificatePreview;
