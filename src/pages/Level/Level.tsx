import "./Level.scss";

import {
    LoaderFunctionArgs,
    useLoaderData,
    useNavigate,
} from "react-router-dom";

import CardsListContainer from "../../components/CardsListContainer/CardsListContainer";
import { LevelId, Card } from "../../lib/definitions";
import { getLevelCards } from "../../lib/utils";

// eslint-disable-next-line react-refresh/only-export-components
export async function loader({ params }: LoaderFunctionArgs) {
    const levelId = params.levelId as LevelId;
    const levelCards = getLevelCards(params.topicId!, levelId);
    return { levelId, levelCards };
}

export default function Level() {
    const navigate = useNavigate();
    const { levelId, levelCards } = useLoaderData() as {
        levelId: LevelId;
        levelCards: Card[];
    };

    return (
        <div className="level">
            <nav>
                <button onClick={() => navigate(-1)}>Back</button>
                <p className="title">Level {levelId}</p>
            </nav>
            <CardsListContainer cardsFrom="level" cardsList={levelCards} />
        </div>
    );
}
