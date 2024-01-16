import "./Card.scss";
import { type ChangeEvent } from "react";
import { motion } from "framer-motion";

interface CardProps {
    data: { front: string; back: string };
    isFlipped: boolean;
    isEditable?: boolean;
    handleClick?: () => void;
    handleChange?: (
        event: ChangeEvent<HTMLTextAreaElement>,
        side: "front" | "back"
    ) => void;
}

export default function Card({
    data,
    isFlipped,
    isEditable = false,
    handleClick,
    handleChange = () => {},
}: CardProps) {
    return (
        <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="card-wrapper"
            onClick={handleClick}
        >
            <div className="card">
                <div className={`inner ${isFlipped ? "flipped" : ""}`}>
                    <textarea
                        className="front"
                        value={data.front}
                        onChange={(event) => handleChange(event, "front")}
                        disabled={!isEditable}
                        maxLength={70}
                    />
                    <textarea
                        className="back"
                        value={data.back}
                        onChange={(event) => handleChange(event, "back")}
                        disabled={!isEditable}
                        maxLength={70}
                    />
                </div>
            </div>
        </motion.div>
    );
}
