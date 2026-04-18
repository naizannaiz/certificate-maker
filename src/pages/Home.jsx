import { useState } from 'react';
import UserForm from '../components/UserForm';
import CertificatePreview from '../components/CertificatePreview';

function Home() {
  const [certData, setCertData] = useState(null);

  const handleGenerate = (data) => {
    setCertData(data);
    // Scroll to preview on mobile
    setTimeout(() => {
      const previewEl = document.getElementById('certificate-preview-section');
      if (previewEl && window.innerWidth < 1024) {
        previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-surface text-on-surface font-body selection:bg-primary/30">
      {/* Background Gradient Blobs */}
      <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 blur-[120px] rounded-full pointer-events-none -z-10"></div>
      <div className="fixed bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-secondary/5 blur-[100px] rounded-full pointer-events-none -z-10"></div>

      {/* Main Workspace Canvas */}
      <main className="p-4 sm:p-6 lg:p-8 grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8 xl:gap-12 bg-surface">
        {/* LEFT PANEL: User Details Form */}
        <section id="user-form-section" className="xl:col-span-5 space-y-4 sm:space-y-6 relative z-10">
          <UserForm onGenerate={handleGenerate} isGenerated={!!certData} />

          {/* Decorative Asset — hidden on small screens to save space */}
          <div className="hidden sm:block relative overflow-hidden h-36 sm:h-48 rounded-2xl border border-white/5 bg-surface-container-low p-4 sm:p-6">
            <div className="relative z-10">
              <h4 className="font-headline text-base sm:text-lg text-secondary">About Certificate Maker</h4>
              <p className="text-on-surface-variant text-xs sm:text-sm mt-1 sm:mt-2 max-w-[240px]">Create beautiful, professional certificates instantly. Fill in the form and download your PDF.</p>
            </div>
            <span className="material-symbols-outlined absolute -bottom-8 -right-8 text-[160px] opacity-5 text-primary rotate-12">verified_user</span>
          </div>
        </section>

        {/* RIGHT PANEL: Certificate Preview */}
        <section id="certificate-preview-section" className="xl:col-span-7 flex flex-col items-center relative z-10">
          <div className="xl:sticky xl:top-24 w-full flex flex-col items-center">
            <CertificatePreview certData={certData} isGenerated={!!certData} />
          </div>
        </section>
      </main>
    </div>
  );
}

export default Home;
