import "./Week.scss";
import { DayOfWeek } from "../../lib/definitions";
import { levelColors } from "../../lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faCheck } from "@fortawesome/free-solid-svg-icons";

interface WeekProps {
    week: Array<DayOfWeek | null>;
    today: number;
}

const letters = ["S", "M", "T", "W", "T", "F", "S"];

export default function Week({ week, today }: WeekProps) {
    return (
        <div className="week">
            {week.map((day, index) => (
                <div key={index + 10} className="day">
                    <small className="letter">{letters[index]}</small>
                    <div className="state-container">
                        {day ? (
                            index < today ? (
                                <FontAwesomeIcon
                                    icon={day.isDone ? faCheck : faXmark}
                                    className={day.isDone ? "passed" : "missed"}
                                />
                            ) : (
                                <div
                                    style={{
                                        backgroundColor:
                                            today === index
                                                ? "purple"
                                                : "transparent",
                                    }}
                                    className="state"
                                ></div>
                            )
                        ) : (
                            <div
                                style={{
                                    backgroundColor: "grey",
                                }}
                                className="state"
                            ></div>
                        )}
                    </div>
                    {day &&
                        levelColors.map((bgColor, index) => (
                            <div
                                key={bgColor}
                                className="level-color"
                                style={{
                                    backgroundColor: day.todayLevels.includes(
                                        index
                                    )
                                        ? bgColor
                                        : "transparent",
                                }}
                            ></div>
                        ))}
                </div>
            ))}
        </div>
    );
}
