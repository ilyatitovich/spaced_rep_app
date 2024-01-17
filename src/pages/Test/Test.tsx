import "./Test.scss";
import { type Topic } from "../../lib/definitions";
import { getTopic } from "../../lib/utils";
import {
    useNavigate,
    useLoaderData,
    type LoaderFunctionArgs,
} from "react-router-dom";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import Card from "../../components/Card/Card";
import Button from "../../components/Buttons/Button";

// eslint-disable-next-line react-refresh/only-export-components
export async function loader({ params }: LoaderFunctionArgs) {
    const topic = await getTopic(params.topicId as string);
    const today: number = new Date().getDay();
    return { topic, today };
}

export default function Test() {
    const navigate = useNavigate();
    const { topic, today } = useLoaderData() as { topic: Topic; today: number };
    const [isFlipped, setIsFlipped] = useState<boolean>(false);

    const { id, week, levels } = topic;

    const cardsForTest = week[today]!.todayLevels.flatMap(
        (el) => levels[el].cards
    );
    const [cards, setCards] = useState(cardsForTest);

    if (cards.length === 0) {
        week[today]!.isDone = true;
        localStorage.setItem(id, JSON.stringify(topic));
    }

    // must be correct
    function handleAnswerClick(answer: "correct" | "not-correct") {
        const updatedCards = [...cards];
        const currentCard = updatedCards.shift();
        const indexToDelete = levels[currentCard!.level].cards.indexOf(
            currentCard!
        );

        if (answer === "correct") {
            levels[currentCard!.level].cards.splice(indexToDelete, 1);
            currentCard!.level += 1;
            levels[currentCard!.level].cards.push(currentCard!);
        } else {
            currentCard!.level = 0;
            levels[0].cards.push(currentCard!);
            updatedCards.push(currentCard!);
        }

        localStorage.setItem(id, JSON.stringify(topic));
        setCards(updatedCards);
    }

    return (
        <div className="screen test">
            <nav>
                <Button
                    handleClick={() => {
                        navigate(-1);
                    }}
                >
                    Back
                </Button>
                <h3>{isFlipped ? "Back" : "Front"}</h3>
                <small className="cards-num">{cards.length}</small>
            </nav>
            <div className="card-container">
                {cards.length > 0 ? (
                    <AnimatePresence>
                        <Card
                            data={cards[0]}
                            isFlipped={isFlipped}
                            handleClick={() => setIsFlipped(!isFlipped)}
                        />
                    </AnimatePresence>
                ) : (
                    <div>No cards</div>
                )}
            </div>

            <div className="btns-container">
                {isFlipped ? (
                    <>
                        <Button
                            testBtn="wrong"
                            handleClick={() => handleAnswerClick("not-correct")}
                        >
                            Wrong
                        </Button>
                        <Button
                            testBtn="correct"
                            handleClick={() => handleAnswerClick("correct")}
                        >
                            Correct
                        </Button>
                    </>
                ) : (
                    <small>tap on card to reweal answer</small>
                )}
            </div>
        </div>
    );
}
