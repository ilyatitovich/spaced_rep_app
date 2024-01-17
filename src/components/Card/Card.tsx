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
    let content;

    if (isEditable) {
        content = (
            <>
                <textarea
                    className="front"
                    value={data.front}
                    onChange={(event) => handleChange(event, "front")}
                    maxLength={70}
                />
                <textarea
                    className="back"
                    value={data.back}
                    onChange={(event) => handleChange(event, "back")}
                    maxLength={70}
                />
            </>
        );
    } else {
        content = (
            <>
                <div className="front">{data.front}</div>
                <div className="back">{data.back}</div>
            </>
        );
    }

    return (
        <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="card-wrapper"
            onClick={handleClick}
        >
            <div className="card">
                <div className={`inner ${isFlipped ? "flipped" : ""}`}>
                    {content}
                </div>
            </div>
        </motion.div>
    );
}
