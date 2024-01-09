import "./LevelRow.scss";
import { type Level } from "../../lib/definitions";

export default function LevelRow({ level }: { level: Level }) {
    return (
        <li className="level">
            <div className="left">
                <span
                    className="color"
                    style={{ backgroundColor: level.color }}
                ></span>
                <span className="number">
                    {level.id === 7 ? "Finished" : `Level ${level.id}`}
                </span>
            </div>
            <div className="right">
                <p>{`${level.cards.length} cards`}</p>
            </div>
        </li>
    );
}
