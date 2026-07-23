import { motion } from 'framer-motion';

export const Scene6 = () => {
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="absolute inset-0">
        <motion.img
          src={`${import.meta.env.BASE_URL}images/hiker.png`}
          className="w-full h-full object-cover"
          alt="Hiker"
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 8, ease: 'linear' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/50 to-transparent opacity-90" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center mt-[10vh]">
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <img 
            src={`${import.meta.env.BASE_URL}images/compass-icon.png`}
            alt="Compass"
            className="w-24 h-24 drop-shadow-2xl brightness-200 mx-auto"
          />
        </motion.div>

        <div className="overflow-hidden mb-6">
          <motion.h1
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            transition={{ duration: 1.2, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-[12vw] font-display font-black text-white leading-none tracking-tight drop-shadow-2xl"
          >
            Walkable
          </motion.h1>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-[3vw] font-body text-accent mb-[4vw] tracking-wide"
        >
          Your walking companion.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 2.0, type: 'spring', stiffness: 120 }}
          className="flex gap-[2vw]"
        >
          <div className="bg-white text-primary px-[3vw] py-[1vw] rounded-[1vw] font-display font-bold text-[1.8vw] shadow-2xl flex items-center gap-[1vw]">
            Download App
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
