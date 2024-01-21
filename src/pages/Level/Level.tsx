import "./Level.scss";
import {
    type LoaderFunctionArgs,
    useLoaderData,
    useNavigate,
    Link,
} from "react-router-dom";
import { type LevelId, type Card } from "../../lib/definitions";
import { getLevelCards } from "../../lib/utils";
import Button from "../../components/Buttons/Button";

// eslint-disable-next-line react-refresh/only-export-components
export async function loader({ params }: LoaderFunctionArgs) {
    const levelId = params.levelId as LevelId;
    const levelCards = await getLevelCards(params.topicId as string, levelId);
    return { levelId, levelCards };
}

export default function Level() {
    const { levelId, levelCards } = useLoaderData() as {
        levelId: LevelId;
        levelCards: Card[];
    };
    const navigate = useNavigate();

    return (
        <div className="screen level">
            <nav>
                <Button handleClick={() => navigate(-1)}>Back</Button>
                <p className="title">Level {levelId}</p>
            </nav>
            <div className="cards-list">
                {levelCards.length > 0 ? (
                    levelCards.map((card) => (
                        <Link
                            key={card.id * Math.random()}
                            to={`${card.id}`}
                            className="card"
                        >
                            <small>{card.front}</small>
                        </Link>
                    ))
                ) : (
                    <div className="message">No cards</div>
                )}
            </div>
        </div>
    );
}
