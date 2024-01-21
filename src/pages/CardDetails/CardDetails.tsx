import "./CardDetails.scss";
import {
    type Topic,
    type LevelId,
    type Card as CardType,
} from "../../lib/definitions";
import {
    type LoaderFunctionArgs,
    useLoaderData,
    useNavigate,
} from "react-router-dom";
import { useState } from "react";
import { getTopic, getCard } from "../../lib/utils";
import Button from "../../components/Buttons/Button";
import Card from "../../components/Card/Card";

// eslint-disable-next-line react-refresh/only-export-components
export async function loader({ params }: LoaderFunctionArgs) {
    const { levelId, cardIndx } = params as {
        levelId: LevelId;
        cardIndx: string;
    };
    const topic: Topic = await getTopic(params.topicId as string);
    const card = await getCard(topic, levelId, Number(params.cardIndx));
    return { levelId, cardIndx, topic, card };
}

export default function CardDetails() {
    const { levelId, cardIndx, topic, card } = useLoaderData() as {
        levelId: LevelId;
        cardIndx: string;
        card: CardType;
        topic: Topic;
    };
    const navigate = useNavigate();
    const [isFlipped, setIsFlipped] = useState<boolean>(false);

    function deleteCard() {
        topic.levels[Number(levelId)-1].cards.splice(Number(cardIndx), 1);
        localStorage.setItem(topic.id, JSON.stringify(topic));
        navigate(-1);
    }

    return (
        <div className="screen card-details">
            <nav>
                <Button
                    handleClick={() => {
                        navigate(-1);
                    }}
                >
                    Back
                </Button>
                <p>{isFlipped ? "Back" : "Front"}</p>
                <Button handleClick={deleteCard}>Delete</Button>
            </nav>
            <div className="card-container">
                <Card data={card} isFlipped={isFlipped} />
            </div>
            <footer>
                <Button handleClick={() => setIsFlipped(!isFlipped)}>
                    Flip
                </Button>
            </footer>
        </div>
    );
}
