import "./Card.scss";
import { useState } from "react";
import { motion } from "framer-motion";

interface CardProps {
    front: string;
    back: string;
}

export default function Card({ front, back }: CardProps) {
    const [isFlipped, setIsFlipped] = useState<boolean>(false);

    return (
        <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ x: 1000, rotate: 45 }}
            transition={{ duration: 0.35 }}
            className="card-wrapper"
            onClick={() => setIsFlipped(!isFlipped)}
        >
            <div className="card">
                <div className={`card-inner ${isFlipped ? "flipped" : ""}`}>
                    <div className="card-front">{front}</div>
                    <div className="card-back">{back}</div>
                </div>
            </div>
        </motion.div>
    );
}
