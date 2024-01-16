import "./Test.scss";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { cardsList } from "../../lib/data";
import Card from "../../components/Card/Card";
import Button from "../../components/Buttons/Button";

export default function Test() {
    const [cards, setCards] = useState(cardsList);

    function handleAnswerClick(answer: "correct" | "not-correct") {
        const updatedCards = [...cards];
        const firstCard = updatedCards.shift();

        if (answer === "not-correct") {
            updatedCards.push(firstCard!);
        }

        setCards(updatedCards);
    }

    return (
        <>
            <div className="cards-container">
                {cards.length > 0 ? (
                    <AnimatePresence>
                        <Card
                            key={cards[0].id}
                            data={cards[0]}
                            isFlipped={true}
                        />
                    </AnimatePresence>
                ) : (
                    <div>No cards</div>
                )}
            </div>

            <div className="btns-container">
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
            </div>
        </>
    );
}
