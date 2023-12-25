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
                            front={cards[0].front}
                            back={cards[0].back}
                        />
                    </AnimatePresence>
                ) : (
                    <div>No cards</div>
                )}
            </div>

            <div className="btns-container">
                <Button
                    title="Not correct"
                    type="wrong"
                    handleClick={() => handleAnswerClick("not-correct")}
                />
                <Button
                    title="Correct"
                    type="correct"
                    handleClick={() => handleAnswerClick("correct")}
                />
            </div>
        </>
    );
}
