import { motion } from 'framer-motion';

export const Scene3 = () => {
  return (
    <motion.div
      className="absolute inset-0 flex flex-col justify-center px-[10vw]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="z-20 text-center mb-[8vw]">
        <motion.div className="overflow-hidden inline-block">
          <motion.h2 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-[6vw] font-display font-bold text-primary leading-none"
          >
            Know what's ahead.
          </motion.h2>
        </motion.div>
        <motion.div className="overflow-hidden mt-4">
          <motion.p 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 1, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-[2.2vw] font-body text-text-secondary"
          >
            Detailed elevation profiles for every route.
          </motion.p>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[40vh] z-10 flex items-end">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 300">
          <defs>
            <linearGradient id="elevationGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0"/>
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--color-accent)" />
              <stop offset="50%" stopColor="var(--color-primary)" />
              <stop offset="100%" stopColor="var(--color-secondary)" />
            </linearGradient>
          </defs>
          
          <motion.path 
            d="M 0 300 L 0 200 Q 100 180 200 100 T 400 150 T 600 50 T 800 120 Q 900 100 1000 50 L 1000 300 Z"
            fill="url(#elevationGrad)"
            initial={{ y: 300, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1.5, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
          
          <motion.path 
            d="M 0 200 Q 100 180 200 100 T 400 150 T 600 50 T 800 120 Q 900 100 1000 50"
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth="6"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2.5, delay: 1, ease: 'easeInOut' }}
          />

          {/* Elevation Markers */}
          {[
            { cx: 200, cy: 100, label: '120m', delay: 1.5 },
            { cx: 600, cy: 50, label: '340m', delay: 2.2 },
            { cx: 1000, cy: 50, label: '280m', delay: 3.0 },
          ].map((marker, i) => (
            <g key={i}>
              <motion.circle 
                cx={marker.cx} cy={marker.cy} r="8" fill="white" stroke="var(--color-primary)" strokeWidth="4"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5, delay: marker.delay, type: 'spring' }}
              />
              <motion.text
                x={marker.cx} y={marker.cy - 20}
                fill="var(--color-primary)"
                fontSize="24"
                fontWeight="bold"
                fontFamily="var(--font-display)"
                textAnchor="middle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: marker.delay + 0.2 }}
              >
                {marker.label}
              </motion.text>
            </g>
          ))}
        </svg>
      </div>
    </motion.div>
  );
};
