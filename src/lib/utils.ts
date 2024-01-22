import { type levelColor, type Topic, type LevelId, type Card } from "./definitions";

export async function getAllTopics() {
    const topics = [];

    for (const key of Object.keys(localStorage)) {
        const topic: Topic = JSON.parse(localStorage.getItem(key) as string);

        const { id, title } = topic;

        topics.push({ id, title });
    }

    return topics;
}

export async function getTopic(id: string) {
    const topic: Topic = await JSON.parse(localStorage.getItem(id) as string);
    return topic;
}

export async function getLevelCards(topicId:string, levelId:LevelId) {
    const topic: Topic = await JSON.parse(localStorage.getItem(topicId) as string);
    const levelCards: Card[] = topic.levels[Number(levelId)-1].cards;
    return levelCards;
}

export async function getCard(topic:Topic, levelId:LevelId, cardIndx:number) {
    const card: Card = topic.levels[Number(levelId)-1].cards[cardIndx];
    return card;
}

export async function getDraftCards(topicId:string) {
    const topic: Topic = await JSON.parse(localStorage.getItem(topicId) as string);
    const draftCards: Card[] = topic.draft;
    return draftCards;
}

export const letters = ["S", "M", "T", "W", "T", "F", "S"];

export const levelColors: levelColor[] = [
    "red",
    "rgb(21, 255, 0)",
    "rgb(255, 251, 0)",
    "rgb(0, 255, 242)",
    "rgb(0, 89, 255)",
    "rgb(183, 0, 255)",
    "rgb(89, 0, 255)",
];
