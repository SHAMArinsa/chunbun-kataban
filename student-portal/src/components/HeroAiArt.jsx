/* Animated AI illustration for the homepage hero (ARINSA blue palette). Pure SVG + CSS, no images. */
const SKILLS = [
  ['Python', 260, 58], ['LLMs', 448, 150], ['RAG', 470, 330],
  ['Agents', 330, 470], ['ML', 120, 440], ['APIs', 52, 250],
]

export default function HeroAiArt({ className = '' }) {
  return (
    <svg className={`heroAi ${className}`} viewBox="0 0 520 520" role="img" aria-label="AI core connected to Python, LLMs, RAG, Agents, ML and APIs">
      <defs>
        <radialGradient id="hai-bg" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#ffffff" /><stop offset=".7" stopColor="#e8f3ff" /><stop offset="1" stopColor="#d8e7f5" /></radialGradient>
        <linearGradient id="hai-core" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2583d8" /><stop offset="1" stopColor="#0b2e59" /></linearGradient>
        <radialGradient id="hai-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#2583d8" stopOpacity=".45" /><stop offset="1" stopColor="#2583d8" stopOpacity="0" /></radialGradient>
        <filter id="hai-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#0b2e59" floodOpacity=".18" /></filter>
      </defs>

      <circle cx="260" cy="260" r="240" fill="url(#hai-bg)" />
      <circle cx="260" cy="260" r="240" fill="none" stroke="#1254a6" strokeWidth="12" />
      <g className="hai-spin"><circle cx="260" cy="260" r="200" fill="none" stroke="#9cc3ea" strokeWidth="1.5" strokeDasharray="4 10" /></g>
      <g className="hai-spin rev"><circle cx="260" cy="260" r="150" fill="none" stroke="#b9d6f2" strokeWidth="1.5" strokeDasharray="2 8" /></g>

      {/* connections with travelling data pulses */}
      {SKILLS.map(([name, x, y], i) => (
        <g key={name}>
          <line x1="260" y1="260" x2={x} y2={y} stroke="#cfe2f6" strokeWidth="2" />
          <line className="hai-pulse" style={{ animationDelay: `${i * 0.45}s` }} x1={x} y1={y} x2="260" y2="260" stroke="#2583d8" strokeWidth="3" strokeLinecap="round" />
        </g>
      ))}

      {/* AI core chip */}
      <circle className="hai-halo" cx="260" cy="260" r="110" fill="url(#hai-glow)" />
      <g filter="url(#hai-shadow)">
        {[0, 1, 2, 3].map((k) => (
          <g key={k} fill="#1254a6">
            <rect x={214 + k * 26} y="176" width="8" height="18" rx="3" />
            <rect x={214 + k * 26} y="326" width="8" height="18" rx="3" />
            <rect x="176" y={214 + k * 26} width="18" height="8" rx="3" />
            <rect x="326" y={214 + k * 26} width="18" height="8" rx="3" />
          </g>
        ))}
        <rect x="190" y="190" width="140" height="140" rx="30" fill="url(#hai-core)" />
        <rect x="204" y="204" width="112" height="112" rx="22" fill="none" stroke="#8ec9ff" strokeOpacity=".5" strokeWidth="2" />
        <text x="260" y="276" textAnchor="middle" fontFamily="Jost, sans-serif" fontWeight="700" fontSize="50" fill="#fff">AI</text>
        <circle className="hai-blink" cx="300" cy="222" r="5" fill="#8ec9ff" />
      </g>

      {/* skill nodes */}
      {SKILLS.map(([name, x, y], i) => {
        const w = 44 + name.length * 9
        return (
          <g key={name} className="hai-float" style={{ animationDelay: `${-i * 0.8}s` }}>
            <rect x={x - w / 2} y={y - 18} width={w} height="36" rx="18" fill="#fff" stroke="#c7dcf1" strokeWidth="1.5" />
            <circle cx={x - w / 2 + 18} cy={y} r="6" fill={i % 2 ? '#2583d8' : '#1254a6'} />
            <text x={x - w / 2 + 32} y={y + 5} fontFamily="Jost, sans-serif" fontWeight="600" fontSize="15" fill="#0b2e59">{name}</text>
          </g>
        )
      })}

      <style>{`
        .heroAi{width:100%;height:auto;overflow:visible}
        .heroAi .hai-spin{transform-origin:260px 260px;animation:haiSpin 40s linear infinite}
        .heroAi .hai-spin.rev{animation-direction:reverse;animation-duration:28s}
        .heroAi .hai-pulse{stroke-dasharray:14 400;stroke-dashoffset:414;animation:haiPulse 2.7s linear infinite}
        .heroAi .hai-halo{transform-origin:260px 260px;animation:haiHalo 3s ease-in-out infinite}
        .heroAi .hai-blink{animation:haiBlink 1.6s ease-in-out infinite}
        .heroAi .hai-float{animation:haiFloat 5s ease-in-out infinite}
        @keyframes haiSpin{to{transform:rotate(360deg)}}
        @keyframes haiPulse{to{stroke-dashoffset:0}}
        @keyframes haiHalo{0%,100%{transform:scale(.9);opacity:.7}50%{transform:scale(1.08);opacity:1}}
        @keyframes haiBlink{50%{opacity:.2}}
        @keyframes haiFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @media (prefers-reduced-motion:reduce){.heroAi *{animation:none!important}}
      `}</style>
    </svg>
  )
}
