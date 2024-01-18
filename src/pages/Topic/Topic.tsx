import "./Topic.scss";
import { Link, LoaderFunctionArgs, useLoaderData } from "react-router-dom";
import { getTopic, letters, levelColors } from "../../lib/utils";
import Button from "../../components/Buttons/Button";
import LevelRow from "../../components/LevelRow/LevelRow";
import { type Topic, type Level } from "../../lib/definitions";

// eslint-disable-next-line react-refresh/only-export-components
export async function loader({ params }: LoaderFunctionArgs) {
    const topic = await getTopic(params.topicId as string);
    const today: number = new Date().getDay();
    return { topic, today };
}

export default function Topic() {
    const { topic, today } = useLoaderData() as { topic: Topic; today: number };

    const { id, title, week, levels } = topic;

    function handleDelete(id: string) {
        localStorage.removeItem(id);
    }

    return (
        <div className="screen topic">
            <nav>
                <Button asLink to="/">
                    Back
                </Button>
                <p className="title">{title}</p>
                <Button asLink to="/" handleClick={() => handleDelete(id)}>
                    Delete
                </Button>
            </nav>

            <div className="week">
                {week.map((day, index) => (
                    <div key={index + 10} className="day">
                        <small className="letter">{letters[index]}</small>
                        <div className="state-container">
                            <div
                                style={{
                                    backgroundColor: day
                                        ? today === index
                                            ? "purple"
                                            : "transparent"
                                        : "grey",
                                }}
                                className="state"
                            ></div>
                        </div>
                        {day &&
                            levelColors.map((bgColor, index) => (
                                <div
                                    key={bgColor}
                                    className="level-color"
                                    style={{
                                        backgroundColor:
                                            day.todayLevels.indexOf(index) !==
                                            -1
                                                ? bgColor
                                                : "transparent",
                                    }}
                                ></div>
                            ))}
                    </div>
                ))}
            </div>

            <div className="content">
                <div className="add-card-wrapper">
                    <h3>Levels</h3>
                    <Button asLink to="new-card">
                        Add Card
                    </Button>
                </div>
                <div className="levels">
                    <ul>
                        {levels.map((level: Level) => (
                            <LevelRow key={level.id} level={level} />
                        ))}
                    </ul>
                </div>

                {!week[today]?.isDone && (
                    <Link to="test" className="today-test-btn">
                        Today Test
                    </Link>
                )}
            </div>
        </div>
    );
}
