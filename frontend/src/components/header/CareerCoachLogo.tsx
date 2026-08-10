export const CareerCoachLogo = () => (
  <svg
    className="brand-logo"
    viewBox="0 0 64 64"
    fill="none"
    role="img"
    aria-label="CareerCoach"
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient id="careercoach-logo-gradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#2563EB" />
        <stop offset="1" stopColor="#7C3AED" />
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="32" fill="url(#careercoach-logo-gradient)" />
    {/* goal ring around the job */}
    <circle cx="32" cy="32" r="17" stroke="#FFFFFF" strokeWidth="4.4" fill="none" />
    {/* briefcase bullseye */}
    <path
      d="M26.8 27.9 v-1.3 a3.1 3.1 0 0 1 3.1 -3.1 h4.2 a3.1 3.1 0 0 1 3.1 3.1 v1.3 h-2.6 v-1.1 a1.3 1.3 0 0 0 -1.3 -1.3 h-2.6 a1.3 1.3 0 0 0 -1.3 1.3 v1.1 Z"
      fill="#FFFFFF"
    />
    <rect x="23" y="28.6" width="18" height="11.2" rx="2.6" fill="#FFFFFF" />
    {/* AI spark accent, pulled inside the circle so it is not clipped by the edge */}
    <path
      d="M48.5 8 Q49.5 13 54 14 Q49.5 15 48.5 20 Q47.5 15 43 14 Q47.5 13 48.5 8 Z"
      fill="#FFFFFF"
      opacity="0.95"
    />
  </svg>
);
