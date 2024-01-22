import "./Topic.scss";
import { Link, type LoaderFunctionArgs, useLoaderData } from "react-router-dom";
import {
    getTopic,
    updateWeek,
    resetIsUpdated,
    letters,
    levelColors,
} from "../../lib/utils";
import Button from "../../components/Buttons/Button";
import LevelRow from "../../components/LevelRow/LevelRow";
import { type Topic, type Level } from "../../lib/definitions";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight } from "@fortawesome/free-solid-svg-icons";

// eslint-disable-next-line react-refresh/only-export-components
export async function loader({ params }: LoaderFunctionArgs) {
    let topic = await getTopic(params.topicId as string);
    const today: number = new Date().getDay();


    // update is Sunday
    if (today === 0 && topic.isUpdated === false) { 
        topic = await updateWeek(topic);

    // reset isUpdated if Monday
    } else if (today === 1 && topic.isUpdated === true) {
        topic = await resetIsUpdated(topic);
    }

    return { topic, today };
}

export default function Topic() {
    const { topic, today } = useLoaderData() as { topic: Topic; today: number };

    const { id, title, week, levels, draft } = topic;

    // week[today]!.isDone = false;  // for test

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
            <div className="wrapper">
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
                                                day.todayLevels.includes(index)
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
                        <h4>Levels</h4>
                        <Button asLink to="new-card">
                            Add Card
                        </Button>
                    </div>

                    {draft.length > 0 && (
                        <div className="draft-row">
                            <Link to="draft">
                                <div className="left">Draft</div>
                                <div className="right">
                                    <span>{`${draft.length} cards`}</span>
                                    <span className="icon">
                                        <FontAwesomeIcon
                                            icon={faChevronRight}
                                        />
                                    </span>
                                </div>
                            </Link>
                        </div>
                    )}

                    <div className="levels">
                        <ul>
                            {levels.map((level: Level) => (
                                <LevelRow key={level.id} level={level} />
                            ))}
                        </ul>
                    </div>

                    {!week[today]?.isDone && (
                        <Link to="test" className="today-test-btn">
                            <h4>Today's Test</h4>
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}
