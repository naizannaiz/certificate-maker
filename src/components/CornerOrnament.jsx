// SVG corner ornament for the certificate
const CornerOrnament = ({ className = '' }) => (
  <svg
    className={className}
    width="60"
    height="60"
    viewBox="0 0 60 60"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M2 2 L20 2 L2 20 Z" fill="none" stroke="#D4AF37" strokeWidth="1.5" />
    <path d="M2 2 L14 2 L2 14 Z" fill="#D4AF37" fillOpacity="0.15" stroke="#D4AF37" strokeWidth="0.5" />
    <path d="M28 2 L30 2" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M2 28 L2 30" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="2" cy="2" r="2" fill="#D4AF37" />
    <circle cx="18" cy="2" r="1" fill="#D4AF37" fillOpacity="0.6" />
    <circle cx="2" cy="18" r="1" fill="#D4AF37" fillOpacity="0.6" />
    <path d="M8 2 L8 8 L2 8" fill="none" stroke="#D4AF37" strokeWidth="0.75" strokeOpacity="0.5" />
  </svg>
);

export default CornerOrnament;
