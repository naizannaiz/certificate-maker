const SealIcon = ({ className = '' }) => (
  <svg
    className={className}
    width="80"
    height="80"
    viewBox="0 0 80 80"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Outer ring */}
    <circle cx="40" cy="40" r="38" stroke="#D4AF37" strokeWidth="1.5" fill="none" />
    <circle cx="40" cy="40" r="34" stroke="#D4AF37" strokeWidth="0.5" fill="none" strokeDasharray="4 3" />
    
    {/* Star/burst rays */}
    {Array.from({ length: 16 }).map((_, i) => {
      const angle = (i * 360) / 16;
      const rad = (angle * Math.PI) / 180;
      const x1 = 40 + 22 * Math.cos(rad);
      const y1 = 40 + 22 * Math.sin(rad);
      const x2 = 40 + 30 * Math.cos(rad);
      const y2 = 40 + 30 * Math.sin(rad);
      return (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#D4AF37"
          strokeWidth={i % 2 === 0 ? "1.5" : "0.75"}
          strokeLinecap="round"
        />
      );
    })}

    {/* Inner shield */}
    <circle cx="40" cy="40" r="18" fill="#D4AF37" fillOpacity="0.08" stroke="#D4AF37" strokeWidth="1" />
    
    {/* Checkmark */}
    <path
      d="M32 40 L37 45 L49 33"
      stroke="#D4AF37"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

export default SealIcon;
