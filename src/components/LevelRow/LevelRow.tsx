import "./LevelRow.scss";
import { type Level } from "../../lib/definitions";
import { Link } from "react-router-dom";

export default function LevelRow({ level }: { level: Level }) {
    return (
        <li className="level-row">
            <Link to={`${level.id-1}`}>
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
            </Link>
        </li>
    );
}
