import { motion } from 'motion/react'

import Spaceship from '../assets/images/rocket-ship.svg?react'

export default function TestDoneMessage() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full text-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-44 h-44"
      >
        <Spaceship />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mt-6 text-3xl font-bold"
      >
        All done!
      </motion.p>
    </div>
  )
}
